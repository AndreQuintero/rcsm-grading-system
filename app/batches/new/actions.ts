"use server";

import { revalidatePath } from "next/cache";
import { batchDbError, batchLabel, batchValues, createBatch, parseBatch } from "@/lib/batch";

export type BatchFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

export async function createBatchAction(_prev: BatchFormState, formData: FormData): Promise<BatchFormState> {
  const parsed = parseBatch(formData);
  if (!parsed.data) return { errors: parsed.errors, values: batchValues(formData) };
  try {
    await createBatch(parsed.data);
  } catch (e) {
    return { errors: batchDbError(e), values: batchValues(formData) };
  }
  // the assigned students leave the "available" list on this page, so re-render it
  revalidatePath("/batches", "layout");
  const n = parsed.data.studentIds.length;
  return { message: `Registered the ${batchLabel(parsed.data)} with ${n} student${n === 1 ? "" : "s"}.` };
}
