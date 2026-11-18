"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { formValues, parseTeacher, teacherDbError } from "@/lib/teacher";
import type { TeacherFormState } from "./new/actions";

export async function updateTeacher(id: number, _prev: TeacherFormState, formData: FormData): Promise<TeacherFormState> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid teacher id");
  const parsed = parseTeacher(formData);
  if (!parsed.data) return { errors: parsed.errors, values: formValues(formData) };

  const { fullName, dateOfBirth, email, subjectIds } = parsed.data;
  try {
    const [updated] = await sql.transaction([
      sql`UPDATE teachers SET full_name = ${fullName}, date_of_birth = ${dateOfBirth}, email = ${email}
        WHERE id = ${id} RETURNING id`,
      sql`DELETE FROM teacher_subjects WHERE teacher_id = ${id}`,
      sql`INSERT INTO teacher_subjects (teacher_id, subject_id)
        SELECT ${id}, unnest(${subjectIds}::int[]) WHERE EXISTS (SELECT 1 FROM teachers WHERE id = ${id})`,
    ]);
    if (!updated.length) return { errors: { form: "This teacher no longer exists." }, values: formValues(formData) };
  } catch (e) {
    return { errors: teacherDbError(e), values: formValues(formData) };
  }
  revalidatePath("/teachers");
  return { message: `Updated ${fullName}.`, values: { fullName, dateOfBirth, email } };
}

export async function deleteTeacher(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid teacher id");
  // teacher_subjects rows go with it (ON DELETE CASCADE)
  await sql`DELETE FROM teachers WHERE id = ${id}`;
  revalidatePath("/teachers");
}
