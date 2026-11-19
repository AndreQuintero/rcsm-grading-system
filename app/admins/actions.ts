"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { syncUserFromRoleTables } from "@/lib/auth/sync";
import { adminDbError, adminValues, parseAdmin } from "@/lib/admin";
import type { AdminFormState } from "@/lib/admin";

export async function updateAdmin(id: number, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid admin id");
  const parsed = parseAdmin(formData);
  if (!parsed.data) return { errors: parsed.errors, values: adminValues(formData) };

  const { fullName, dateOfBirth, email } = parsed.data;
  try {
    // "o" is the row before this statement, so the old email comes back for the account sync
    const updated = await sql`
      UPDATE admins a SET full_name = ${fullName}, date_of_birth = ${dateOfBirth}, email = ${email}, updated_at = now()
      FROM (SELECT email AS old_email FROM admins WHERE id = ${id}) o
      WHERE a.id = ${id} RETURNING a.id, o.old_email`;
    if (!updated.length) return { errors: { form: "This admin no longer exists." }, values: adminValues(formData) };
    await syncUserFromRoleTables(updated[0].old_email as string);
  } catch (e) {
    return { errors: adminDbError(e), values: adminValues(formData) };
  }
  await syncUserFromRoleTables(email);
  revalidatePath("/admins");
  return { message: `Updated ${fullName}.`, values: { fullName, dateOfBirth, email } };
}

export async function deleteAdmin(id: number): Promise<void> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid admin id");
  const [gone] = await sql`DELETE FROM admins WHERE id = ${id} RETURNING email`;
  if (gone) await syncUserFromRoleTables(gone.email as string);
  revalidatePath("/admins");
}
