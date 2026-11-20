import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { batchLabel } from "@/lib/batch";
import { periodKey, type SemesterChoice } from "@/lib/dashboard";
import type { Grades } from "@/lib/grading-shared";

// Grades and subject batches belong to (semester, subject), so every teacher of that subject in that semester
// sees and edits the same data. Access: the teacher must teach the subject in the semester (`teaches`).

export async function teacherIdForUser(userId: number): Promise<number | null> {
  const [r] = await sql`SELECT profile_id FROM user_roles WHERE user_id = ${userId} AND role = 'teacher'`;
  return (r?.profile_id as number) ?? null;
}

// The semesters the teacher has subjects in, newest first in time order.
// The signed-in teacher's id (teachers.id); every grading page and action starts here.
export async function requireTeacher(): Promise<{ teacherId: number; userId: number; name: string }> {
  const s = await requireRole("teacher");
  const teacherId = await teacherIdForUser(s.userId);
  if (!teacherId) throw new Error("Forbidden");
  return { teacherId, userId: s.userId, name: s.username };
}

export async function teacherSemesters(teacherId: number): Promise<SemesterChoice[]> {
  const rows = await sql`
    SELECT DISTINCT a.id, a.year, a.semester FROM academic_semesters a
    JOIN academic_semester_teacher_subjects x ON x.academic_semester_id = a.id
    WHERE x.teacher_id = ${teacherId}`;
  return rows
    .map((r) => ({ id: r.id as number, year: r.year as number, semester: r.semester as number }))
    .sort((a, b) => periodKey(b) - periodKey(a));
}

export async function teaches(semesterId: number, subjectId: number, teacherId: number): Promise<boolean> {
  const [r] = await sql`SELECT 1 FROM academic_semester_teacher_subjects
    WHERE academic_semester_id = ${semesterId} AND subject_id = ${subjectId} AND teacher_id = ${teacherId}`;
  return Boolean(r);
}

// Students a subject grades: not inactive, in a batch bound to the subject that is still in the semester.
const gradedStudents = (semester = "$1", subject = "$2") => `
  SELECT st.*, sb.batch_id AS bound_batch FROM students st
  JOIN subject_batches sb ON sb.batch_id = st.batch_id
  JOIN academic_semester_batches ab ON ab.academic_semester_id = sb.academic_semester_id AND ab.batch_id = sb.batch_id
  WHERE sb.academic_semester_id = ${semester} AND sb.subject_id = ${subject} AND st.status <> 'inactive'`;

// The teacher's subjects in a semester, with how many students they grade and how many have all 4 grades.
export async function teacherSubjects(semesterId: number, teacherId: number) {
  const rows = await sql.query(
    `SELECT s.id, s.name,
       (SELECT count(*) FROM subject_batches sb JOIN academic_semester_batches ab
          ON ab.academic_semester_id = sb.academic_semester_id AND ab.batch_id = sb.batch_id
        WHERE sb.academic_semester_id = $1 AND sb.subject_id = s.id)::int AS batches,
       (SELECT count(*) FROM (${gradedStudents("$1", "s.id")}) g)::int AS students,
       (SELECT count(*) FROM (${gradedStudents("$1", "s.id")}) g JOIN grades gr
          ON gr.academic_semester_id = $1 AND gr.subject_id = s.id AND gr.student_id = g.id
        WHERE num_nonnulls(gr.midterm, gr.participation, gr.presence, gr.final_exam) = 4)::int AS complete
     FROM academic_semester_teacher_subjects x JOIN subjects s ON s.id = x.subject_id
     WHERE x.academic_semester_id = $1 AND x.teacher_id = $2
     ORDER BY s.name`,
    [semesterId, teacherId],
  );
  return rows as { id: number; name: string; batches: number; students: number; complete: number }[];
}

// The subject's page: bound batches (still in the semester), the semester's other batches, and the students with grades.
export async function subjectGrading(semesterId: number, subjectId: number) {
  const [[head], batches, students] = await Promise.all([
    sql`SELECT a.year, a.semester, s.name FROM academic_semesters a, subjects s WHERE a.id = ${semesterId} AND s.id = ${subjectId}`,
    sql`SELECT b.id, b.number, b.year, b.semester,
          EXISTS (SELECT 1 FROM subject_batches sb WHERE sb.academic_semester_id = ${semesterId}
            AND sb.subject_id = ${subjectId} AND sb.batch_id = b.id) AS bound,
          (SELECT count(*) FROM students st WHERE st.batch_id = b.id AND st.status <> 'inactive')::int AS students
        FROM academic_semester_batches ab JOIN batches b ON b.id = ab.batch_id
        WHERE ab.academic_semester_id = ${semesterId}
        ORDER BY b.year, b.semester, b.number`,
    sql.query(
      `SELECT g.id, concat_ws(' ', g.first_name, g.middle_name, g.last_name) AS name, g.status, g.photo IS NOT NULL AS has_photo,
         b.number, b.year, b.semester, gr.midterm, gr.participation, gr.presence, gr.final_exam
       FROM (${gradedStudents()}) g
       JOIN batches b ON b.id = g.bound_batch
       LEFT JOIN grades gr ON gr.academic_semester_id = $1 AND gr.subject_id = $2 AND gr.student_id = g.id
       ORDER BY g.last_name, g.first_name, g.id`,
      [semesterId, subjectId],
    ),
  ]);
  if (!head) return null;
  const label = (b: Record<string, unknown>) => batchLabel(b as { number: number; year: number; semester: number });
  return {
    subject: head.name as string,
    period: { year: head.year as number, semester: head.semester as number },
    batches: batches.map((b) => ({ id: b.id as number, label: label(b), bound: b.bound as boolean, students: b.students as number })),
    students: students.map((s) => ({
      id: s.id as number, name: s.name as string, status: s.status as string, hasPhoto: s.has_photo as boolean,
      batch: label(s),
      grades: { midterm: s.midterm, participation: s.participation, presence: s.presence, final_exam: s.final_exam } as Grades,
    })),
  };
}

// One student's grading page; null when the student isn't graded in this subject (wrong batch, inactive, unknown).
export async function studentGrading(semesterId: number, subjectId: number, studentId: number) {
  const [r] = await sql.query(
    `SELECT g.id, concat_ws(' ', g.first_name, g.middle_name, g.last_name) AS name, g.email, g.status,
       date_part('year', age(current_date, g.date_of_birth))::int AS age, g.photo IS NOT NULL AS has_photo,
       b.number, b.year, b.semester,
       gr.midterm, gr.participation, gr.presence, gr.final_exam, gr.comment,
       to_char(gr.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS updated, u.username AS updated_by
     FROM (${gradedStudents()}) g
     JOIN batches b ON b.id = g.bound_batch
     LEFT JOIN grades gr ON gr.academic_semester_id = $1 AND gr.subject_id = $2 AND gr.student_id = g.id
     LEFT JOIN users u ON u.id = gr.updated_by
     WHERE g.id = $3`,
    [semesterId, subjectId, studentId],
  );
  if (!r) return null;
  return {
    id: r.id as number, name: r.name as string, email: (r.email as string) ?? null, status: r.status as string,
    age: r.age as number, hasPhoto: r.has_photo as boolean,
    batch: batchLabel(r as { number: number; year: number; semester: number }),
    grades: { midterm: r.midterm, participation: r.participation, presence: r.presence, final_exam: r.final_exam } as Grades,
    comment: (r.comment as string) ?? "",
    updated: (r.updated as string) ?? null,
    updatedBy: (r.updated_by as string) ?? null,
  };
}

// A teacher may see a student's photo when the student's batch is in a semester the teacher teaches in.
export async function teacherCanSeeStudent(teacherId: number, studentId: number): Promise<boolean> {
  const [r] = await sql`
    SELECT 1 FROM students st
    JOIN academic_semester_batches ab ON ab.batch_id = st.batch_id
    JOIN academic_semester_teacher_subjects x ON x.academic_semester_id = ab.academic_semester_id
    WHERE st.id = ${studentId} AND x.teacher_id = ${teacherId} LIMIT 1`;
  return Boolean(r);
}

// Only a batch that is in the semester can be bound. Returns false otherwise.
export async function bindBatch(semesterId: number, subjectId: number, batchId: number): Promise<boolean> {
  const rows = await sql`
    INSERT INTO subject_batches (academic_semester_id, subject_id, batch_id)
    SELECT ${semesterId}, ${subjectId}, ${batchId}
    WHERE EXISTS (SELECT 1 FROM academic_semester_batches WHERE academic_semester_id = ${semesterId} AND batch_id = ${batchId})
    ON CONFLICT DO NOTHING RETURNING batch_id`;
  return rows.length > 0;
}

// Grades are kept: binding the batch again shows them.
export async function unbindBatch(semesterId: number, subjectId: number, batchId: number) {
  await sql`DELETE FROM subject_batches WHERE academic_semester_id = ${semesterId} AND subject_id = ${subjectId} AND batch_id = ${batchId}`;
}

// Saves the grades only for a student the subject grades (same rule as studentGrading). Returns false otherwise.
export async function saveGrades(
  semesterId: number, subjectId: number, studentId: number, userId: number, g: Grades & { comment: string | null },
): Promise<boolean> {
  const rows = await sql.query(
    `INSERT INTO grades (academic_semester_id, subject_id, student_id, midterm, participation, presence, final_exam, comment, updated_by)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
     WHERE EXISTS (SELECT 1 FROM (${gradedStudents()}) g WHERE g.id = $3)
     ON CONFLICT (academic_semester_id, subject_id, student_id) DO UPDATE SET
       midterm = EXCLUDED.midterm, participation = EXCLUDED.participation, presence = EXCLUDED.presence,
       final_exam = EXCLUDED.final_exam, comment = EXCLUDED.comment, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING student_id`,
    [semesterId, subjectId, studentId, g.midterm, g.participation, g.presence, g.final_exam, g.comment, userId],
  );
  return rows.length > 0;
}
