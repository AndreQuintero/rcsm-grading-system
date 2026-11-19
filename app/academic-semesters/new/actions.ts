"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  academicSemesterDbError, academicSemesterValues, createAcademicSemester, parseAcademicSemester, periodLabel,
  type AcademicSemesterFormState,
} from "@/lib/academic-semester";

export async function createAcademicSemesterAction(_prev: AcademicSemesterFormState, formData: FormData): Promise<AcademicSemesterFormState> {
  await requireRole("admin");
  const parsed = parseAcademicSemester(formData);
  if (!parsed.data) return { errors: parsed.errors, values: academicSemesterValues(formData) };
  try {
    await createAcademicSemester(parsed.data);
  } catch (e) {
    return { errors: await academicSemesterDbError(e, parsed.data), values: academicSemesterValues(formData) };
  }
  revalidatePath("/academic-semesters");
  return { message: `Registered the academic semester ${periodLabel(parsed.data)}.` };
}
