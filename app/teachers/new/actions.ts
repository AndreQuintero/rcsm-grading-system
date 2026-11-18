"use server";

import { sql } from "@/lib/db";
import { parseTeacher } from "@/lib/teacher";

export type TeacherFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

export async function createTeacher(
  _prev: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  const parsed = parseTeacher(formData);
  if (!parsed.data) {
    const values = Object.fromEntries(
      ["fullName", "dateOfBirth", "email", "subjects"].map((k) => [k, String(formData.get(k) ?? "")]),
    );
    return { errors: parsed.errors, values };
  }

  const { fullName, dateOfBirth, email, subjects } = parsed.data;
  try {
    await sql`INSERT INTO teachers (full_name, date_of_birth, email, subjects)
      VALUES (${fullName}, ${dateOfBirth}, ${email}, ${subjects})`;
  } catch (e) {
    // 23505 = unique_violation (duplicate email)
    if ((e as { code?: string }).code === "23505")
      return { errors: { email: "A teacher with this email is already registered." } };
    throw e;
  }
  return { message: `Registered ${fullName}.` };
}
