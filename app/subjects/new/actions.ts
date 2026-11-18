"use server";

import { sql } from "@/lib/db";

export type SubjectFormState = { errors?: string; message?: string };

export async function createSubjects(names: string[]): Promise<SubjectFormState> {
  const cleaned = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  if (cleaned.length === 0) return { errors: "Add at least one subject name." };
  if (cleaned.some((n) => n.length > 100)) return { errors: "Subject names must be 100 characters or fewer." };

  const inserted = await sql`INSERT INTO subjects (name)
    SELECT unnest(${cleaned}::text[]) ON CONFLICT (name) DO NOTHING RETURNING name`;
  const added = inserted.map((r) => r.name as string);
  const skipped = cleaned.filter((n) => !added.includes(n));

  const message = `Added ${added.length} subject${added.length === 1 ? "" : "s"}.`;
  return skipped.length ? { message: `${message} Already existed: ${skipped.join(", ")}.` } : { message };
}
