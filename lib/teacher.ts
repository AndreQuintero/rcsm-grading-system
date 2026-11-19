import { sql } from "@/lib/db";
import { isRealDate, todayIso } from "@/lib/dates";
import { parsePhoto, photoBase64 } from "@/lib/photo";
import { syncUserFromRoleTables } from "@/lib/auth/sync";

export type TeacherInput = {
  fullName: string;
  dateOfBirth: string;
  email: string;
  photo: File | null;
};

export type TeacherParse =
  | { data: TeacherInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined };

// Positive integer ids from repeated form fields (e.g. hidden inputs of a picker).
export function parseIds(values: FormDataEntryValue[] | string[]): number[] {
  return [...new Set(values.map((v) => String(v)).filter((v) => /^\d+$/.test(v)).map(Number))].filter((n) => n > 0);
}

// Validates untrusted form input; the server action re-runs this, so the client is not trusted.
export function parseTeacher(formData: FormData): TeacherParse {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const { photo, error: photoError } = parsePhoto(formData);

  const errors: Record<string, string> = {};
  if (photoError) errors.photo = photoError;
  const today = todayIso();
  if (!fullName) errors.fullName = "Full name is required.";
  if (!isRealDate(dateOfBirth))
    errors.dateOfBirth = "Enter a valid date of birth.";
  else if (dateOfBirth > today) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (Object.keys(errors).length) return { errors };
  return { data: { fullName, dateOfBirth, email, photo } };
}

// Raw text fields, used to re-fill the form after a validation error.
export function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(["fullName", "dateOfBirth", "email"].map((k) => [k, String(formData.get(k) ?? "")]));
}

// Maps Postgres errors the user can fix to form errors; anything else is rethrown.
export function teacherDbError(e: unknown): Record<string, string> {
  const code = (e as { code?: string }).code;
  if (code === "23505") return { email: "A teacher with this email is already registered." };
  throw e;
}

export async function getTeacher(id: number) {
  const [t] = await sql`
    SELECT id, full_name, date_of_birth::text AS dob, email, photo IS NOT NULL AS has_photo
    FROM teachers WHERE id = ${id}`;
  return t ?? null;
}

export const PAGE_SIZE = 10;

// Filters: name and email are case-insensitive substrings.
export async function listTeachers({
  name = "",
  email = "",
  page = 1,
}: {
  name?: string;
  email?: string;
  page?: number;
}) {
  const rows = await sql`
    SELECT t.id, t.full_name, t.date_of_birth::text AS dob, t.email, count(*) OVER() AS total
    FROM teachers t
    WHERE (${name} = '' OR t.full_name ILIKE ${"%" + name + "%"})
      AND (${email} = '' OR t.email ILIKE ${"%" + email + "%"})
    ORDER BY t.full_name, t.id
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
  return { teachers: rows, total: rows.length ? Number(rows[0].total) : 0 };
}

export type TeacherFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

// Registers a teacher, then gives them a sign-in account (users/user_roles).
// The "use server" action wraps this with the admin check; self-check scripts call it directly.
export async function insertTeacher(formData: FormData): Promise<TeacherFormState> {
  const parsed = parseTeacher(formData);
  if (!parsed.data) return { errors: parsed.errors, values: formValues(formData) };

  const { fullName, dateOfBirth, email, photo } = parsed.data;
  const photoB64 = await photoBase64(photo);
  try {
    await sql`
      INSERT INTO teachers (full_name, date_of_birth, email, photo, photo_type)
      VALUES (${fullName}, ${dateOfBirth}, ${email}, decode(${photoB64}::text, 'base64'), ${photo?.type ?? null})`;
  } catch (e) {
    return { errors: teacherDbError(e), values: formValues(formData) };
  }
  await syncUserFromRoleTables(email);
  return { message: `Registered ${fullName}.` };
}
