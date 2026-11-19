"use server";

import { sql } from "@/lib/db";
import { adminDbError, adminValues, parseAdmin } from "@/lib/admin";

export type AdminFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

export async function createAdmin(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const parsed = parseAdmin(formData);
  if (!parsed.data) return { errors: parsed.errors, values: adminValues(formData) };

  const { fullName, dateOfBirth, email } = parsed.data;
  try {
    await sql`INSERT INTO admins (full_name, date_of_birth, email) VALUES (${fullName}, ${dateOfBirth}, ${email})`;
  } catch (e) {
    return { errors: adminDbError(e), values: adminValues(formData) };
  }
  return { message: `Registered ${fullName}.` };
}
