import { sql } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import { batchLabel, batchPeriod } from "@/lib/batch";
import { USER_STATUS_SQL } from "@/lib/user";

export type SemesterChoice = { id: number; year: number; semester: number };

// Time order of a period: the 2nd semester (January–May) comes before the 1st (June–December) of the same year.
export const periodKey = (p: { year: number; semester: number }) => p.year * 2 + (p.semester === 1 ? 1 : 0);

// The semester running today; else the latest one that has started; else (all in the future) the nearest one.
export function pickDefault(choices: SemesterChoice[], today = todayIso()): SemesterChoice | null {
  const now = periodKey(batchPeriod(today));
  const started = choices.filter((c) => periodKey(c) <= now);
  const pool = started.length ? started : choices;
  if (!pool.length) return null;
  return pool.reduce((best, c) => ((started.length ? periodKey(c) > periodKey(best) : periodKey(c) < periodKey(best)) ? c : best));
}

export async function dashboardCounts() {
  const [c] = await sql.query(`
    SELECT
      (SELECT count(*) FROM students)::int AS students,
      (SELECT count(*) FROM students WHERE status = 'full_time')::int AS full_time,
      (SELECT count(*) FROM students WHERE status = 'audit')::int AS audit,
      (SELECT count(*) FROM students WHERE status = 'inactive')::int AS inactive,
      (SELECT count(*) FROM teachers)::int AS teachers,
      (SELECT count(*) FROM subjects)::int AS subjects,
      (SELECT count(*) FROM admins)::int AS admins,
      (SELECT count(*) FROM users u WHERE ${USER_STATUS_SQL} = 'active')::int AS active_users`);
  return c as { students: number; full_time: number; audit: number; inactive: number; teachers: number; subjects: number; admins: number; active_users: number };
}

// Newest first, in time order (not registration order).
export async function semesterChoices(): Promise<SemesterChoice[]> {
  const rows = await sql`SELECT id, year, semester FROM academic_semesters`;
  return rows
    .map((r) => ({ id: r.id as number, year: r.year as number, semester: r.semester as number }))
    .sort((a, b) => periodKey(b) - periodKey(a));
}

export type DashboardTeacher = { id: number; name: string; email: string; age: number; hasPhoto: boolean; subjects: string[] };
export type DashboardStudent = { id: number; name: string; status: string; age: number; hasPhoto: boolean };

// The semester's teachers with the subjects they teach in it, and its batches with their students who are not inactive.
export async function semesterDetail(id: number) {
  const [teachers, batches] = await Promise.all([
    sql`SELECT t.id, t.full_name, t.email, t.photo IS NOT NULL AS has_photo,
          date_part('year', age(current_date, t.date_of_birth))::int AS age,
          array_agg(s.name ORDER BY s.name) AS subjects
        FROM academic_semester_teacher_subjects x
        JOIN teachers t ON t.id = x.teacher_id
        JOIN subjects s ON s.id = x.subject_id
        WHERE x.academic_semester_id = ${id}
        GROUP BY t.id ORDER BY t.full_name, t.id`,
    sql`SELECT b.id, b.number, b.year, b.semester,
          coalesce(json_agg(json_build_object(
            'id', st.id, 'name', concat_ws(' ', st.first_name, st.middle_name, st.last_name), 'status', st.status,
            'age', date_part('year', age(current_date, st.date_of_birth))::int, 'hasPhoto', st.photo IS NOT NULL
          ) ORDER BY st.last_name, st.first_name, st.id) FILTER (WHERE st.id IS NOT NULL), '[]') AS students
        FROM academic_semester_batches ab
        JOIN batches b ON b.id = ab.batch_id
        LEFT JOIN students st ON st.batch_id = b.id AND st.status <> 'inactive'
        WHERE ab.academic_semester_id = ${id}
        GROUP BY b.id ORDER BY b.year, b.semester, b.number`,
  ]);
  return {
    teachers: teachers.map((t): DashboardTeacher => ({
      id: t.id as number, name: t.full_name as string, email: t.email as string, age: t.age as number,
      hasPhoto: t.has_photo as boolean, subjects: t.subjects as string[],
    })),
    batches: batches.map((b) => ({
      id: b.id as number,
      label: batchLabel(b as { number: number; year: number; semester: number }),
      students: b.students as DashboardStudent[],
    })),
  };
}
