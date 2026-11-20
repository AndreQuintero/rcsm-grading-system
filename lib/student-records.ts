import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { batchLabel } from "@/lib/batch";
import { periodKey } from "@/lib/dashboard";
import { gradeAverages, gradeTotal, overallScore, type Grades } from "@/lib/grading-shared";

// Admin student records. Every caller checks requireRole("admin").
// A student's (semester, subject) rows: their batch is bound to the subject and still in the semester, or they have
// grades there (history survives a batch change). Same rule as the teacher's score records, without a teacher. $1 = student
// (inner aliases are s0, so the query can be correlated with an outer `st`).
const STUDENT_ROWS = `
  SELECT sb.academic_semester_id AS sem, sb.subject_id AS subj FROM students s0
  JOIN subject_batches sb ON sb.batch_id = s0.batch_id
  JOIN academic_semester_batches ab ON ab.academic_semester_id = sb.academic_semester_id AND ab.batch_id = sb.batch_id
  WHERE s0.id = $1
  UNION
  SELECT academic_semester_id, subject_id FROM grades WHERE student_id = $1`;

// A student's semesters: those that include their batch, plus any with their grades. $1 = student.
const STUDENT_SEMESTERS = `
  SELECT ab.academic_semester_id AS sem FROM students s0 JOIN academic_semester_batches ab ON ab.batch_id = s0.batch_id WHERE s0.id = $1
  UNION
  SELECT academic_semester_id FROM grades WHERE student_id = $1`;

export const STUDENT_RECORDS_PAGE_SIZE = 10;
const label = (b: Record<string, unknown>) => (b.number === null ? null : batchLabel(b as { number: number; year: number; semester: number }));

// All students (inactive too), 10 per page. batch: an id, or "none" for students without a batch.
export async function listStudentRecords({ name = "", email = "", batch = "", status = "", page = 1 }: { name?: string; email?: string; batch?: string; status?: string; page?: number } = {}) {
  const batchId = /^\d+$/.test(batch) ? Number(batch) : null;
  const rows = await sql.query(
    `SELECT st.id, concat_ws(' ', st.first_name, st.middle_name, st.last_name) AS name, st.email, st.status,
       st.photo IS NOT NULL AS has_photo, b.number, b.year, b.semester,
       (SELECT count(*) FROM (${STUDENT_SEMESTERS.replaceAll("$1", "st.id")}) x)::int AS semesters,
       count(*) OVER() AS total
     FROM students st LEFT JOIN batches b ON b.id = st.batch_id
     WHERE ($1 = '' OR concat_ws(' ', st.first_name, st.middle_name, st.last_name) ILIKE '%' || $1 || '%')
       AND ($2 = '' OR st.email ILIKE '%' || $2 || '%')
       AND ($3 = '' OR st.status = $3)
       AND ($4 <> 'none' OR st.batch_id IS NULL)
       AND ($5::int IS NULL OR st.batch_id = $5)
     ORDER BY st.last_name, st.first_name, st.id
     LIMIT ${STUDENT_RECORDS_PAGE_SIZE} OFFSET $6`,
    [name, email, status, batch, batchId, (page - 1) * STUDENT_RECORDS_PAGE_SIZE],
  );
  return {
    students: rows.map((r) => ({
      id: r.id as number, name: r.name as string, email: (r.email as string) ?? null, status: r.status as string,
      hasPhoto: r.has_photo as boolean, batch: label(r), semesters: r.semesters as number,
    })),
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

export async function studentRecordBatches() {
  const rows = await sql`SELECT id, number, year, semester FROM batches ORDER BY year DESC, semester DESC, number DESC`;
  return rows.map((b) => ({ id: b.id as number, label: label(b)! }));
}

async function studentHead(id: number) {
  const [st] = await sql`
    SELECT st.id, concat_ws(' ', st.first_name, st.middle_name, st.last_name) AS name, st.email, st.status,
      date_part('year', age(current_date, st.date_of_birth))::int AS age, st.photo IS NOT NULL AS has_photo,
      b.number, b.year, b.semester
    FROM students st LEFT JOIN batches b ON b.id = st.batch_id WHERE st.id = ${id}`;
  if (!st) return null;
  return {
    id: st.id as number, name: st.name as string, email: (st.email as string) ?? null, status: st.status as string,
    age: st.age as number, hasPhoto: st.has_photo as boolean, batch: label(st),
  };
}
export type StudentHead = NonNullable<Awaited<ReturnType<typeof studentHead>>>;

// The student's semesters, newest first in time order, each with its grading summary. null: unknown student.
export async function studentSemesters(id: number) {
  const head = await studentHead(id);
  if (!head) return null;
  const rows = await sql.query(
    `SELECT a.id, a.year, a.semester,
       coalesce((SELECT json_agg(json_build_object('midterm', g.midterm, 'participation', g.participation,
          'presence', g.presence, 'final_exam', g.final_exam))
        FROM (${STUDENT_ROWS}) r LEFT JOIN grades g ON g.academic_semester_id = r.sem AND g.subject_id = r.subj AND g.student_id = $1
        WHERE r.sem = a.id), '[]') AS grades
     FROM academic_semesters a WHERE a.id IN (${STUDENT_SEMESTERS})`,
    [id],
  );
  const semesters = rows
    .map((r) => {
      const grades = (r.grades as Grades[]).map((g) => ({ midterm: g.midterm, participation: g.participation, presence: g.presence, final_exam: g.final_exam }));
      const graded = grades.filter((g) => gradeTotal(g).given > 0);
      return {
        id: r.id as number, year: r.year as number, semester: r.semester as number,
        subjects: grades.length, graded: graded.length,
        totalAvg: gradeAverages(graded).total.avg, pct: overallScore(graded.map((grades) => ({ grades }))).pct,
      };
    })
    .sort((a, b) => periodKey(b) - periodKey(a));
  return { ...head, semesters };
}

export type RecordTeacher = { id: number; name: string; email: string; hasPhoto: boolean };

// One semester of the student's record: a row per subject that grades them, with that subject's teachers in the
// semester. null when the student is unknown or the semester isn't one of theirs.
export async function studentSemesterRecord(id: number, semesterId: number) {
  const [head, [sem], rows] = await Promise.all([
    studentHead(id),
    sql.query(`SELECT a.id, a.year, a.semester FROM academic_semesters a WHERE a.id = $2 AND a.id IN (${STUDENT_SEMESTERS})`, [id, semesterId]),
    sql.query(
      `SELECT r.subj, s.name AS subject, g.midterm, g.participation, g.presence, g.final_exam, g.comment,
         to_char(g.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS updated, u.username AS updated_by,
         coalesce((SELECT json_agg(json_build_object('id', t.id, 'name', t.full_name, 'email', t.email, 'hasPhoto', t.photo IS NOT NULL) ORDER BY t.full_name)
           FROM academic_semester_teacher_subjects x JOIN teachers t ON t.id = x.teacher_id
           WHERE x.academic_semester_id = r.sem AND x.subject_id = r.subj), '[]') AS teachers
       FROM (${STUDENT_ROWS}) r
       JOIN subjects s ON s.id = r.subj
       LEFT JOIN grades g ON g.academic_semester_id = r.sem AND g.subject_id = r.subj AND g.student_id = $1
       LEFT JOIN users u ON u.id = g.updated_by
       WHERE r.sem = $2
       ORDER BY s.name`,
      [id, semesterId],
    ),
  ]);
  if (!head || !sem) return null;
  return {
    ...head,
    period: { id: sem.id as number, year: sem.year as number, semester: sem.semester as number },
    rows: rows.map((r) => ({
      subjectId: r.subj as number, subject: r.subject as string,
      grades: { midterm: r.midterm, participation: r.participation, presence: r.presence, final_exam: r.final_exam } as Grades,
      comment: (r.comment as string) ?? null, updated: (r.updated as string) ?? null, updatedBy: (r.updated_by as string) ?? null,
      teachers: r.teachers as RecordTeacher[],
    })),
  };
}

// The record for "all" semesters or one of the student's semesters: the student, their semesters (for the picker) and
// the subject rows tagged with their period. null when the student is unknown or the semester isn't theirs.
export async function studentRecordView(id: number, which: "all" | number) {
  const list = await studentSemesters(id);
  if (!list) return null;
  const all = which === "all";
  const records = await Promise.all((all ? list.semesters.map((s) => s.id) : [which]).map((sid) => studentSemesterRecord(id, sid)));
  if (records.some((x) => !x)) return null;
  const rows = records.flatMap((rec) => rec!.rows.map((x) => ({ ...x, period: rec!.period })));
  return { student: list, semesters: list.semesters, all, period: all ? null : records[0]!.period, rows };
}
export type StudentRecordView = NonNullable<Awaited<ReturnType<typeof studentRecordView>>>;

// The signed-in student's id (students.id), from the session only; every "My records" page starts here.
export async function requireStudent(): Promise<number> {
  const s = await requireRole("student");
  const [r] = await sql`SELECT profile_id FROM user_roles WHERE user_id = ${s.userId} AND role = 'student'`;
  if (!r) throw new Error("Forbidden");
  return r.profile_id as number;
}

// A student may see a teacher's photo when that teacher teaches a subject that grades them (in that semester).
export async function studentCanSeeTeacher(studentId: number, teacherId: number): Promise<boolean> {
  const [r] = await sql.query(
    `SELECT 1 FROM (${STUDENT_ROWS}) r JOIN academic_semester_teacher_subjects x
       ON x.academic_semester_id = r.sem AND x.subject_id = r.subj
     WHERE x.teacher_id = $2 LIMIT 1`,
    [studentId, teacherId],
  );
  return Boolean(r);
}
