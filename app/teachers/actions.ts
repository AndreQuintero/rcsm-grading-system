"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { formValues, parseTeacher } from "@/lib/teacher";
import type { TeacherFormState } from "./new/actions";

export async function updateTeacher(id: number, _prev: TeacherFormState, formData: FormData): Promise<TeacherFormState> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid teacher id");
  const parsed = parseTeacher(formData);
  if (!parsed.data) return { errors: parsed.errors, values: formValues(formData) };

  const { fullName, dateOfBirth, email, subjects } = parsed.data;
  try {
    const rows = await sql`UPDATE teachers
      SET full_name = ${fullName}, date_of_birth = ${dateOfBirth}, email = ${email}, subjects = ${subjects}
      WHERE id = ${id} RETURNING id`;
    if (!rows.length) return { errors: { form: "This teacher no longer exists." }, values: formValues(formData) };
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      return { errors: { email: "A teacher with this email is already registered." }, values: formValues(formData) };
    throw e;
  }
  revalidatePath("/teachers");
  return {
    message: `Updated ${fullName}.`,
    values: { fullName, dateOfBirth, email, subjects: subjects.join("\n") },
  };
}

export async function deleteTeacher(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid teacher id");
  await sql`DELETE FROM teachers WHERE id = ${id}`;
  revalidatePath("/teachers");
}
