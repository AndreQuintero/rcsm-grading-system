"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { adminDbError, adminValues, parseAdmin } from "@/lib/admin";
import type { AdminFormState } from "./new/actions";

export async function updateAdmin(id: number, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid admin id");
  const parsed = parseAdmin(formData);
  if (!parsed.data) return { errors: parsed.errors, values: adminValues(formData) };

  const { fullName, dateOfBirth, email } = parsed.data;
  try {
    const updated = await sql`
      UPDATE admins SET full_name = ${fullName}, date_of_birth = ${dateOfBirth}, email = ${email}, updated_at = now()
      WHERE id = ${id} RETURNING id`;
    if (!updated.length) return { errors: { form: "This admin no longer exists." }, values: adminValues(formData) };
  } catch (e) {
    return { errors: adminDbError(e), values: adminValues(formData) };
  }
  revalidatePath("/admins");
  return { message: `Updated ${fullName}.`, values: { fullName, dateOfBirth, email } };
}

export async function deleteAdmin(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid admin id");
  await sql`DELETE FROM admins WHERE id = ${id}`;
  revalidatePath("/admins");
}
