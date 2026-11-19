"use server";

import { requireRole } from "@/lib/auth/session";
import { insertTeacher, type TeacherFormState } from "@/lib/teacher";

export type { TeacherFormState };

export async function createTeacher(_prev: TeacherFormState, formData: FormData): Promise<TeacherFormState> {
  await requireRole("admin");
  return insertTeacher(formData);
}
