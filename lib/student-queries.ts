import { sql } from "@/lib/db";
import { syncUserFromRoleTables } from "@/lib/auth/sync";
import { autoBatchNote, batchPeriod } from "@/lib/batch";
import { photoBase64 } from "@/lib/photo";
import { parseStudent, studentDbError, studentValues } from "@/lib/student";

export type StudentFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

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
      enrollment_date::text AS enrolled, email, photo IS NOT NULL AS has_photo
    FROM students WHERE id = ${id}`;
  return s ?? null;
}

// Registers a student (joining the batch of their enrollment period if it exists), then syncs their sign-in
// account. Wrapped by the "use server" action (admin check); self-check scripts call it directly.
export async function insertStudent(formData: FormData): Promise<StudentFormState> {
  const parsed = parseStudent(formData);
  if (!parsed.data) return { errors: parsed.errors, values: studentValues(formData) };

  const { firstName, middleName, lastName, email, dateOfBirth, status, enrollmentDate, photo } = parsed.data;
  const photoB64 = await photoBase64(photo);
  const period = batchPeriod(enrollmentDate);
  // One statement: the student joins the batch for their enrollment year and semester when one exists
  // (a year and semester has at most one batch, and the status does not matter); otherwise batch_id stays empty.
  let row;
  try {
    [row] = await sql`
    WITH ins AS (
      INSERT INTO students (first_name, middle_name, last_name, email, date_of_birth, status, enrollment_date, photo, photo_type, batch_id)
      VALUES (${firstName}, ${middleName}, ${lastName}, ${email}, ${dateOfBirth}, ${status}, ${enrollmentDate},
        decode(${photoB64}::text, 'base64'), ${photo?.type ?? null},
        (SELECT id FROM batches WHERE year = ${period.year} AND semester = ${period.semester}))
      RETURNING batch_id
    )
    SELECT b.number, b.year, b.semester
    FROM ins LEFT JOIN batches b ON b.id = ins.batch_id`;
  } catch (e) {
    return { errors: studentDbError(e), values: studentValues(formData) };
  }
  await syncUserFromRoleTables(email);
  const note = autoBatchNote(true, period, {
    number: row.number as number | null,
    year: row.year as number | null,
    semester: row.semester as number | null,
  });
  return { message: `Registered ${firstName} ${lastName}.${note}` };
}
