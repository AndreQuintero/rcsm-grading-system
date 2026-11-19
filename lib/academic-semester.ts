import { sql } from "@/lib/db";
import { batchLabel } from "@/lib/batch";
import { ordinal } from "@/lib/dates";
import { parseIds } from "@/lib/teacher";

export const ACADEMIC_SEMESTER_PAGE_SIZE = 10;

export const periodLabel = (s: { year: number; semester: number }) => `${s.year} – ${ordinal(s.semester)} semester`;

// Each teacher in the semester with the subjects they teach in it (at least one).
export type TeacherSubjects = { teacherId: number; subjectIds: number[] };
export type AcademicSemesterInput = { year: number; semester: 1 | 2; batchIds: number[]; teachers: TeacherSubjects[] };
export type AcademicSemesterFormState = { errors?: Record<string, string>; message?: string; values?: Record<string, string> };

// Form fields: year, semester, batchIds (repeated), teacherIds (repeated), and per teacher subjects-<teacherId> (repeated).
// Validates untrusted input; the server action re-runs this, so the client is not trusted.
export function parseAcademicSemester(formData: FormData):
  | { data: AcademicSemesterInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined } {
  const int = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return /^\d+$/.test(v) ? Number(v) : NaN;
  };
  const year = int("year");
  const semester = int("semester");
  const batchIds = parseIds(formData.getAll("batchIds"));
  const teachers = parseIds(formData.getAll("teacherIds")).map((teacherId) => ({
    teacherId,
    subjectIds: parseIds(formData.getAll(`subjects-${teacherId}`)),
  }));

  const errors: Record<string, string> = {};
  if (!(year >= 2000 && year <= 2100)) errors.year = "Enter a year between 2000 and 2100.";
  if (semester !== 1 && semester !== 2) errors.semester = "Choose the 1st or 2nd semester.";
  for (const t of teachers) if (!t.subjectIds.length) errors[`teacher-${t.teacherId}`] = "Choose at least one subject for this teacher.";

  if (Object.keys(errors).length) return { errors };
  return { data: { year, semester: semester as 1 | 2, batchIds, teachers } };
}

// Raw fields to re-fill the form after an error; the teacher rows travel as JSON.
export function academicSemesterValues(formData: FormData): Record<string, string> {
  const teachers: TeacherSubjects[] = parseIds(formData.getAll("teacherIds")).map((teacherId) => ({
    teacherId,
    subjectIds: parseIds(formData.getAll(`subjects-${teacherId}`)),
  }));
  return {
    year: String(formData.get("year") ?? ""),
    semester: String(formData.get("semester") ?? ""),
    batchIds: parseIds(formData.getAll("batchIds")).join(","),
    teachers: JSON.stringify(teachers),
  };
}

// Parallel arrays (teacher, subject) for unnest.
const pairs = (teachers: TeacherSubjects[]) => {
  const t: number[] = [], s: number[] = [];
  for (const x of teachers) for (const id of x.subjectIds) { t.push(x.teacherId); s.push(id); }
  return { t, s };
};

// Maps Postgres errors the user can fix to form errors; anything else is rethrown.
export async function academicSemesterDbError(e: unknown, input: { year: number; semester: number }): Promise<Record<string, string>> {
  const code = (e as { code?: string }).code;
  // 23505 = unique_violation on (year, semester)
  if (code === "23505")
    return { period: `An academic semester is already registered for ${periodLabel(input)}. Each year and semester can have only one. Choose another year or semester, or edit that one.` };
  // 23503 = a chosen batch, teacher or subject was deleted meanwhile
  if (code === "23503") return { form: "One of the selected batches, teachers or subjects no longer exists. Reload and try again." };
  throw e;
}

// One statement, so the semester, its batches and its teacher subjects are saved together or not at all.
export async function createAcademicSemester({ year, semester, batchIds, teachers }: AcademicSemesterInput): Promise<number> {
  const { t, s } = pairs(teachers);
  const [row] = await sql`
    WITH a AS (
      INSERT INTO academic_semesters (year, semester) VALUES (${year}, ${semester}) RETURNING id
    ), b AS (
      INSERT INTO academic_semester_batches (academic_semester_id, batch_id) SELECT a.id, unnest(${batchIds}::int[]) FROM a
    ), ts AS (
      INSERT INTO academic_semester_teacher_subjects (academic_semester_id, teacher_id, subject_id)
      SELECT a.id, x.t, x.s FROM a, unnest(${t}::int[], ${s}::int[]) AS x(t, s)
    )
    SELECT id FROM a`;
  return row.id as number;
}

// Updates the period and replaces the batches and teacher subjects in one transaction. False if the semester is gone.
export async function updateAcademicSemester(id: number, { year, semester, batchIds, teachers }: AcademicSemesterInput): Promise<boolean> {
  const { t, s } = pairs(teachers);
  const [updated] = await sql.transaction([
    sql`UPDATE academic_semesters SET year = ${year}, semester = ${semester}, updated_at = now() WHERE id = ${id} RETURNING id`,
    sql`DELETE FROM academic_semester_batches WHERE academic_semester_id = ${id}`,
    sql`INSERT INTO academic_semester_batches (academic_semester_id, batch_id)
        SELECT ${id}, unnest(${batchIds}::int[]) WHERE EXISTS (SELECT 1 FROM academic_semesters WHERE id = ${id})`,
    sql`DELETE FROM academic_semester_teacher_subjects WHERE academic_semester_id = ${id}`,
    sql`INSERT INTO academic_semester_teacher_subjects (academic_semester_id, teacher_id, subject_id)
        SELECT ${id}, x.t, x.s FROM unnest(${t}::int[], ${s}::int[]) AS x(t, s)
        WHERE EXISTS (SELECT 1 FROM academic_semesters WHERE id = ${id})`,
  ]);
  return updated.length > 0;
}

export async function getAcademicSemester(id: number) {
  const [a] = await sql`
    SELECT a.id, a.year, a.semester,
      coalesce((SELECT array_agg(batch_id ORDER BY batch_id) FROM academic_semester_batches WHERE academic_semester_id = a.id), '{}') AS batch_ids,
      coalesce((SELECT json_agg(json_build_object('teacherId', teacher_id, 'subjectIds', subject_ids) ORDER BY full_name)
        FROM (SELECT x.teacher_id, t.full_name, array_agg(x.subject_id ORDER BY x.subject_id) AS subject_ids
              FROM academic_semester_teacher_subjects x JOIN teachers t ON t.id = x.teacher_id
              WHERE x.academic_semester_id = a.id GROUP BY x.teacher_id, t.full_name) g), '[]') AS teachers
    FROM academic_semesters a WHERE a.id = ${id}`;
  if (!a) return null;
  return {
    id: a.id as number,
    year: a.year as number,
    semester: a.semester as number,
    batchIds: a.batch_ids as number[],
    teachers: a.teachers as TeacherSubjects[],
  };
}

// year is an exact match; null means any. Newest first.
export async function listAcademicSemesters({ year = null, page = 1 }: { year?: number | null; page?: number }) {
  const rows = await sql`
    SELECT a.id, a.year, a.semester,
      coalesce((SELECT json_agg(json_build_object('number', b.number, 'year', b.year, 'semester', b.semester)
        ORDER BY b.year, b.semester, b.number) FROM academic_semester_batches ab JOIN batches b ON b.id = ab.batch_id
        WHERE ab.academic_semester_id = a.id), '[]') AS batches,
      (SELECT count(*) FROM students s JOIN academic_semester_batches ab ON ab.batch_id = s.batch_id
        WHERE ab.academic_semester_id = a.id)::int AS students,
      (SELECT count(DISTINCT teacher_id) FROM academic_semester_teacher_subjects WHERE academic_semester_id = a.id)::int AS teachers,
      (SELECT count(DISTINCT subject_id) FROM academic_semester_teacher_subjects WHERE academic_semester_id = a.id)::int AS subjects,
      count(*) OVER() AS total
    FROM academic_semesters a
    WHERE ${year}::int IS NULL OR a.year = ${year}
    ORDER BY a.year DESC, a.semester DESC, a.id DESC
    LIMIT ${ACADEMIC_SEMESTER_PAGE_SIZE} OFFSET ${(page - 1) * ACADEMIC_SEMESTER_PAGE_SIZE}`;
  return { semesters: rows, total: rows.length ? Number(rows[0].total) : 0 };
}

// Everything the form can pick from: all batches, teachers and subjects.
export async function semesterOptions() {
  const [batches, teachers, subjects] = await Promise.all([
    sql`SELECT b.id, b.number, b.year, b.semester, (SELECT count(*) FROM students s WHERE s.batch_id = b.id)::int AS students
        FROM batches b ORDER BY b.year DESC, b.semester DESC, b.number DESC`,
    sql`SELECT id, full_name, photo IS NOT NULL AS has_photo FROM teachers ORDER BY full_name, id`,
    sql`SELECT id, name FROM subjects ORDER BY name`,
  ]);
  return {
    batches: batches.map((b) => ({ id: b.id as number, label: batchLabel(b as { number: number; year: number; semester: number }), students: b.students as number })),
    teachers: teachers.map((t) => ({ id: t.id as number, name: t.full_name as string, hasPhoto: t.has_photo as boolean })),
    subjects: subjects.map((s) => ({ id: s.id as number, name: s.name as string })),
  };
}
