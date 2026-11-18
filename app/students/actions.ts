"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { parseStudent, studentValues } from "@/lib/student";
import type { StudentFormState } from "./new/actions";

export async function updateStudent(id: number, _prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid student id");
  const parsed = parseStudent(formData);
  if (!parsed.data) return { errors: parsed.errors, values: studentValues(formData) };

  const { firstName, middleName, lastName, dateOfBirth, status, enrollmentDate, photo } = parsed.data;
  // A new photo replaces the stored one; "remove" clears it; otherwise the stored photo is kept.
  const replacePhoto = Boolean(photo) || formData.get("removePhoto") === "on";
  const photoB64 = photo ? Buffer.from(await photo.arrayBuffer()).toString("base64") : null;
  const rows = await sql`UPDATE students SET
      first_name = ${firstName}, middle_name = ${middleName}, last_name = ${lastName},
      date_of_birth = ${dateOfBirth}, status = ${status}, enrollment_date = ${enrollmentDate},
      photo = CASE WHEN ${replacePhoto}::boolean THEN decode(${photoB64}::text, 'base64') ELSE photo END,
      photo_type = CASE WHEN ${replacePhoto}::boolean THEN ${photo?.type ?? null}::text ELSE photo_type END
    WHERE id = ${id} RETURNING id`;
  if (!rows.length) return { errors: { form: "This student no longer exists." }, values: studentValues(formData) };

  revalidatePath("/students");
  return {
    message: `Updated ${firstName} ${lastName}.`,
    values: { firstName, middleName: middleName ?? "", lastName, dateOfBirth, status, enrollmentDate: enrollmentDate ?? "" },
  };
}

export async function deleteStudent(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid student id");
  await sql`DELETE FROM students WHERE id = ${id}`;
  revalidatePath("/students");
}
