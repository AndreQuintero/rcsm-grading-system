"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { autoBatchNote, batchPeriod } from "@/lib/batch";
import { requireRole } from "@/lib/auth/session";
import { syncUserFromRoleTables } from "@/lib/auth/sync";
import { parseStudent, studentDbError, studentValues } from "@/lib/student";
import type { StudentFormState } from "@/lib/student-queries";

export async function updateStudent(id: number, _prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid student id");
  const parsed = parseStudent(formData);
  if (!parsed.data) return { errors: parsed.errors, values: studentValues(formData) };

  const { firstName, middleName, lastName, email, dateOfBirth, status, enrollmentDate, photo } = parsed.data;
  // A new photo replaces the stored one; "remove" clears it; otherwise the stored photo is kept.
  const replacePhoto = Boolean(photo) || formData.get("removePhoto") === "on";
  const photoB64 = photo ? Buffer.from(await photo.arrayBuffer()).toString("base64") : null;
  const period = batchPeriod(enrollmentDate);
  // The batch is only filled in automatically for a student who has none yet, whose enrollment date
  // changed; a student already in a batch is never moved by an edit.
  // "old" is the row as it was before this statement, so the comparison sees the previous values.
  let rows;
  try {
    rows = await sql`
    WITH old AS (SELECT batch_id, enrollment_date, email FROM students WHERE id = ${id}),
    upd AS (
      UPDATE students SET
        first_name = ${firstName}, middle_name = ${middleName}, last_name = ${lastName}, email = ${email},
        date_of_birth = ${dateOfBirth}, status = ${status}, enrollment_date = ${enrollmentDate},
        photo = CASE WHEN ${replacePhoto}::boolean THEN decode(${photoB64}::text, 'base64') ELSE photo END,
        photo_type = CASE WHEN ${replacePhoto}::boolean THEN ${photo?.type ?? null}::text ELSE photo_type END,
        batch_id = CASE
          WHEN (SELECT batch_id FROM old) IS NULL
            AND (SELECT enrollment_date FROM old) IS DISTINCT FROM ${enrollmentDate}::date
          THEN (SELECT id FROM batches WHERE year = ${period.year} AND semester = ${period.semester})
          ELSE batch_id
        END
      WHERE id = ${id}
      RETURNING id, batch_id
    )
    SELECT b.number, b.year, b.semester,
      ((SELECT batch_id FROM old) IS NULL
        AND (SELECT enrollment_date FROM old) IS DISTINCT FROM ${enrollmentDate}::date) AS attempted,
      (SELECT email FROM old) AS old_email
    FROM upd LEFT JOIN batches b ON b.id = upd.batch_id`;
  } catch (e) {
    return { errors: studentDbError(e), values: studentValues(formData) };
  }
  if (!rows.length) return { errors: { form: "This student no longer exists." }, values: studentValues(formData) };
  // the old email loses the student role if it changed; the new one gains it
  if (rows[0].old_email) await syncUserFromRoleTables(rows[0].old_email as string);
  await syncUserFromRoleTables(email);

  const row = rows[0];
  const note = autoBatchNote(row.attempted as boolean, period, {
    number: row.number as number | null,
    year: row.year as number | null,
    semester: row.semester as number | null,
  });
  revalidatePath("/students");
  revalidatePath("/batches", "layout"); // a batch's student count may have changed
  return {
    message: `Updated ${firstName} ${lastName}.${note}`,
    values: { firstName, middleName: middleName ?? "", lastName, email, dateOfBirth, status, enrollmentDate },
  };
}

export async function deleteStudent(id: number): Promise<void> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid student id");
  const [gone] = await sql`DELETE FROM students WHERE id = ${id} RETURNING email`;
  if (gone?.email) await syncUserFromRoleTables(gone.email as string);
  revalidatePath("/students");
}
