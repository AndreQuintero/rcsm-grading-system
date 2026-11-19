import { sql } from "@/lib/db";
import { isRealDate, todayIso } from "@/lib/dates";

export const ADMIN_PAGE_SIZE = 10;

export type AdminInput = { fullName: string; dateOfBirth: string; email: string };

export type AdminParse =
  | { data: AdminInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined };

// Validates untrusted form input; the server actions re-run this, so the client is not trusted.
export function parseAdmin(formData: FormData): AdminParse {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const errors: Record<string, string> = {};
  if (!fullName) errors.fullName = "Full name is required.";
  if (!isRealDate(dateOfBirth)) errors.dateOfBirth = "Enter a valid date of birth.";
  else if (dateOfBirth > todayIso()) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (Object.keys(errors).length) return { errors };
  return { data: { fullName, dateOfBirth, email } };
}

// Raw text fields, used to re-fill the form after an error.
export function adminValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(["fullName", "dateOfBirth", "email"].map((k) => [k, String(formData.get(k) ?? "")]));
}

// Maps Postgres errors the user can fix to form errors; anything else is rethrown.
export function adminDbError(e: unknown): Record<string, string> {
  if ((e as { code?: string }).code === "23505") return { email: "An admin with this email is already registered." };
  throw e;
}

export async function getAdmin(id: number) {
  const [a] = await sql`SELECT id, full_name, date_of_birth::text AS dob, email FROM admins WHERE id = ${id}`;
  return a ?? null;
}

// name and email are case-insensitive substrings. Timestamps are shown in UTC.
export async function listAdmins({ name = "", email = "", page = 1 }: { name?: string; email?: string; page?: number }) {
  const rows = await sql`
    SELECT id, full_name, date_of_birth::text AS dob, email,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created,
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS updated,
      count(*) OVER() AS total
    FROM admins
    WHERE (${name} = '' OR full_name ILIKE ${"%" + name + "%"})
      AND (${email} = '' OR email ILIKE ${"%" + email + "%"})
    ORDER BY full_name, id
    LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${(page - 1) * ADMIN_PAGE_SIZE}`;
  return { admins: rows, total: rows.length ? Number(rows[0].total) : 0 };
}
