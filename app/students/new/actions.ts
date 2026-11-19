"use server";

import { requireRole } from "@/lib/auth/session";
import { insertStudent, type StudentFormState } from "@/lib/student-queries";

export type { StudentFormState };

export async function createStudent(_prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  await requireRole("admin");
  return insertStudent(formData);
}
