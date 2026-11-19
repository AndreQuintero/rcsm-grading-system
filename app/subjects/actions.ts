"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import type { SubjectFormState } from "@/lib/subject";
import { requireRole } from "@/lib/auth/session";

export async function updateSubject(id: number, rawName: string): Promise<SubjectFormState> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid subject id");
  const name = String(rawName).trim();
  if (!name) return { errors: "Enter a subject name." };
  if (name.length > 100) return { errors: "Subject names must be 100 characters or fewer." };
  try {
    const rows = await sql`UPDATE subjects SET name = ${name} WHERE id = ${id} RETURNING id`;
    if (!rows.length) return { errors: "This subject no longer exists." };
  } catch (e) {
    // 23505 = unique_violation (duplicate name)
    if ((e as { code?: string }).code === "23505") return { errors: "A subject with this name already exists." };
    throw e;
  }
  revalidatePath("/subjects");
  return { message: `Updated ${name}.` };
}

export async function deleteSubject(id: number): Promise<void> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid subject id");
  await sql`DELETE FROM subjects WHERE id = ${id}`;
  revalidatePath("/subjects");
}
