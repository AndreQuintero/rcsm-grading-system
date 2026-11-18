import { sql } from "@/lib/db";

export const STUDENT_PAGE_SIZE = 10;

// name matches any part of "first middle last" (case-insensitive); status is "", "full_time" or "audit".
// The photo is never selected here, so listing stays light.
export async function listStudents({ name = "", status = "", page = 1 }: { name?: string; status?: string; page?: number }) {
  const rows = await sql`
    SELECT id, first_name, middle_name, last_name, date_of_birth::text AS dob, status,
      enrollment_date::text AS enrolled, count(*) OVER() AS total
    FROM students
    WHERE (${name} = '' OR concat_ws(' ', first_name, middle_name, last_name) ILIKE ${"%" + name + "%"})
      AND (${status} = '' OR status = ${status})
    ORDER BY last_name, first_name, id
    LIMIT ${STUDENT_PAGE_SIZE} OFFSET ${(page - 1) * STUDENT_PAGE_SIZE}`;
  return { students: rows, total: rows.length ? Number(rows[0].total) : 0 };
}

export async function getStudent(id: number) {
  const [s] = await sql`
    SELECT id, first_name, middle_name, last_name, date_of_birth::text AS dob, status,
      enrollment_date::text AS enrolled, photo IS NOT NULL AS has_photo
    FROM students WHERE id = ${id}`;
  return s ?? null;
}
