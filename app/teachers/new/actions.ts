"use server";

import { sql } from "@/lib/db";
import { formValues, parseTeacher, teacherDbError } from "@/lib/teacher";

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
  if (!parsed.data) return { errors: parsed.errors, values: formValues(formData) };

  const { fullName, dateOfBirth, email, subjectIds } = parsed.data;
  try {
    // One statement, so the teacher and its subject links are saved together or not at all.
    await sql`
      WITH t AS (
        INSERT INTO teachers (full_name, date_of_birth, email)
        VALUES (${fullName}, ${dateOfBirth}, ${email}) RETURNING id
      )
      INSERT INTO teacher_subjects (teacher_id, subject_id)
      SELECT t.id, unnest(${subjectIds}::int[]) FROM t`;
  } catch (e) {
    return { errors: teacherDbError(e), values: formValues(formData) };
  }
  return { message: `Registered ${fullName}.` };
}
