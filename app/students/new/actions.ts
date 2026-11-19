"use server";

import { sql } from "@/lib/db";
import { autoBatchNote, batchPeriod } from "@/lib/batch";
import { parseStudent, studentValues } from "@/lib/student";

export type StudentFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

export async function createStudent(_prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const parsed = parseStudent(formData);
  if (!parsed.data) return { errors: parsed.errors, values: studentValues(formData) };

  const { firstName, middleName, lastName, dateOfBirth, status, enrollmentDate, photo } = parsed.data;
  const photoB64 = photo ? Buffer.from(await photo.arrayBuffer()).toString("base64") : null;
  const period = batchPeriod(enrollmentDate);
  // One statement: the student joins the batch for their enrollment year and semester when one exists
  // (a year and semester has at most one batch, and the status does not matter); otherwise batch_id stays empty.
  const [row] = await sql`
    WITH ins AS (
      INSERT INTO students (first_name, middle_name, last_name, date_of_birth, status, enrollment_date, photo, photo_type, batch_id)
      VALUES (${firstName}, ${middleName}, ${lastName}, ${dateOfBirth}, ${status}, ${enrollmentDate},
        decode(${photoB64}::text, 'base64'), ${photo?.type ?? null},
        (SELECT id FROM batches WHERE year = ${period.year} AND semester = ${period.semester}))
      RETURNING batch_id
    )
    SELECT b.number, b.year, b.semester
    FROM ins LEFT JOIN batches b ON b.id = ins.batch_id`;
  const note = autoBatchNote(true, period, {
    number: row.number as number | null,
    year: row.year as number | null,
    semester: row.semester as number | null,
  });
  return { message: `Registered ${firstName} ${lastName}.${note}` };
}
