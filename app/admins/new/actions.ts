"use server";

import { requireRole } from "@/lib/auth/session";
import { insertAdmin, type AdminFormState } from "@/lib/admin";

export type { AdminFormState };

export async function createAdmin(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  return insertAdmin(formData);
}
