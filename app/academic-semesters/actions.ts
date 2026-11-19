"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import {
  academicSemesterDbError, academicSemesterValues, parseAcademicSemester, periodLabel, updateAcademicSemester,
  type AcademicSemesterFormState,
} from "@/lib/academic-semester";

export async function updateAcademicSemesterAction(id: number, _prev: AcademicSemesterFormState, formData: FormData): Promise<AcademicSemesterFormState> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid academic semester id");
  const parsed = parseAcademicSemester(formData);
  if (!parsed.data) return { errors: parsed.errors, values: academicSemesterValues(formData) };
  try {
    if (!(await updateAcademicSemester(id, parsed.data)))
      return { errors: { form: "This academic semester no longer exists." }, values: academicSemesterValues(formData) };
  } catch (e) {
    return { errors: await academicSemesterDbError(e, parsed.data), values: academicSemesterValues(formData) };
  }
  revalidatePath("/academic-semesters", "layout");
  return { message: `Updated the academic semester ${periodLabel(parsed.data)}.`, values: academicSemesterValues(formData) };
}

// Batches, teachers and subjects are kept; only the semester and its links go (ON DELETE CASCADE).
export async function deleteAcademicSemester(id: number): Promise<void> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid academic semester id");
  await sql`DELETE FROM academic_semesters WHERE id = ${id}`;
  revalidatePath("/academic-semesters", "layout");
}
