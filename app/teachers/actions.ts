"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { syncUserFromRoleTables } from "@/lib/auth/sync";
import { formValues, parseTeacher, teacherDbError } from "@/lib/teacher";
import type { TeacherFormState } from "@/lib/teacher";

export async function updateTeacher(id: number, _prev: TeacherFormState, formData: FormData): Promise<TeacherFormState> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid teacher id");
  const parsed = parseTeacher(formData);
  if (!parsed.data) return { errors: parsed.errors, values: formValues(formData) };

  const { fullName, dateOfBirth, email, subjectIds } = parsed.data;
  try {
    const [updated] = await sql.transaction([
      // "o" is the row before this statement, so the old email comes back for the account sync
      sql`UPDATE teachers t SET full_name = ${fullName}, date_of_birth = ${dateOfBirth}, email = ${email}
        FROM (SELECT email AS old_email FROM teachers WHERE id = ${id}) o
        WHERE t.id = ${id} RETURNING t.id, o.old_email`,
      sql`DELETE FROM teacher_subjects WHERE teacher_id = ${id}`,
      sql`INSERT INTO teacher_subjects (teacher_id, subject_id)
        SELECT ${id}, unnest(${subjectIds}::int[]) WHERE EXISTS (SELECT 1 FROM teachers WHERE id = ${id})`,
    ]);
    if (!updated.length) return { errors: { form: "This teacher no longer exists." }, values: formValues(formData) };
    await syncUserFromRoleTables(updated[0].old_email as string);
  } catch (e) {
    return { errors: teacherDbError(e), values: formValues(formData) };
  }
  await syncUserFromRoleTables(email);
  revalidatePath("/teachers");
  return { message: `Updated ${fullName}.`, values: { fullName, dateOfBirth, email } };
}

export async function deleteTeacher(id: number): Promise<void> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid teacher id");
  // teacher_subjects rows go with it (ON DELETE CASCADE); the account loses the teacher role
  const [gone] = await sql`DELETE FROM teachers WHERE id = ${id} RETURNING email`;
  if (gone) await syncUserFromRoleTables(gone.email as string);
  revalidatePath("/teachers");
}
