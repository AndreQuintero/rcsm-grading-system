"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { batchDbError, batchLabel, batchValues, duplicatePeriodMessage, isDuplicateBatch, parseBatch, updateBatch } from "@/lib/batch";
import type { BatchFormState } from "./new/actions";

export async function updateBatchAction(id: number, _prev: BatchFormState, formData: FormData): Promise<BatchFormState> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid batch id");
  const parsed = parseBatch(formData);
  if (!parsed.data) return { errors: parsed.errors, values: batchValues(formData) };
  try {
    if (!(await updateBatch(id, parsed.data))) return { errors: { form: "This batch no longer exists." }, values: batchValues(formData) };
  } catch (e) {
    const errors = isDuplicateBatch(e)
      ? { period: await duplicatePeriodMessage(parsed.data.year, parsed.data.semester) }
      : batchDbError(e);
    return { errors, values: batchValues(formData) };
  }
  revalidatePath("/batches", "layout");
  return { message: `Updated the ${batchLabel(parsed.data)}.`, values: batchValues(formData) };
}

// Students in the batch are kept; their batch is cleared (ON DELETE SET NULL).
export async function deleteBatch(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid batch id");
  await sql`DELETE FROM batches WHERE id = ${id}`;
  revalidatePath("/batches", "layout");
}
