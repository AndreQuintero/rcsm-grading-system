"use server";

import { revalidatePath } from "next/cache";
import { subjectInSemester } from "@/lib/academic-semester";
import { requireRole } from "@/lib/auth/session";
import { bindBatch, unbindBatch } from "@/lib/grading";

const ids = (...n: number[]) => n.every((x) => Number.isInteger(x) && x > 0);

// Admin only, and only for a subject taught in this semester.
async function allowed(semesterId: number, subjectId: number, batchId: number) {
  await requireRole("admin");
  if (!ids(semesterId, subjectId, batchId) || !(await subjectInSemester(semesterId, subjectId))) throw new Error("Forbidden");
}

const refresh = () => {
  revalidatePath("/academic-semesters", "layout");
  revalidatePath("/teacher", "layout");
};

export async function assignBatchAction(semesterId: number, subjectId: number, batchId: number): Promise<{ error?: string }> {
  await allowed(semesterId, subjectId, batchId);
  if (!(await bindBatch(semesterId, subjectId, batchId))) return { error: "This batch is not in this semester any more. Reload and try again." };
  refresh();
  return {};
}

// Grades are kept: assigning the batch again shows them.
export async function unassignBatchAction(semesterId: number, subjectId: number, batchId: number): Promise<void> {
  await allowed(semesterId, subjectId, batchId);
  await unbindBatch(semesterId, subjectId, batchId);
  refresh();
}
