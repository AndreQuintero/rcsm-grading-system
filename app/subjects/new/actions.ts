"use server";

import { requireRole } from "@/lib/auth/session";
import { insertSubjects, type SubjectFormState } from "@/lib/subject";

export type { SubjectFormState };

export async function createSubjects(names: string[]): Promise<SubjectFormState> {
  await requireRole("admin");
  return insertSubjects(names);
}
