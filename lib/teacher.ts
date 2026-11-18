import { sql } from "@/lib/db";

export type TeacherInput = {
  fullName: string;
  dateOfBirth: string;
  email: string;
  subjectIds: number[];
};

export type TeacherParse =
  | { data: TeacherInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined };

// Positive integer ids from repeated form fields (e.g. hidden inputs of the subject picker).
export function parseIds(values: FormDataEntryValue[] | string[]): number[] {
  return [...new Set(values.map((v) => String(v)).filter((v) => /^\d+$/.test(v)).map(Number))].filter((n) => n > 0);
}

// Validates untrusted form input; the server action re-runs this, so the client is not trusted.
export function parseTeacher(formData: FormData): TeacherParse {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const subjectIds = parseIds(formData.getAll("subjectIds"));

  const errors: Record<string, string> = {};
  const today = new Date().toISOString().slice(0, 10);
  if (!fullName) errors.fullName = "Full name is required.";
  // Date.parse rolls over impossible days (2026-02-31), so the round trip must match the input.
  const isRealDate = (s: string) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !isRealDate(dateOfBirth))
    errors.dateOfBirth = "Enter a valid date of birth.";
  else if (dateOfBirth > today) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (subjectIds.length === 0) errors.subjectIds = "Choose at least one subject.";

  if (Object.keys(errors).length) return { errors };
  return { data: { fullName, dateOfBirth, email, subjectIds } };
}

// Raw text fields, used to re-fill the form after a validation error (the subject picker keeps its own state).
export function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(["fullName", "dateOfBirth", "email"].map((k) => [k, String(formData.get(k) ?? "")]));
}

// Maps Postgres errors the user can fix to form errors; anything else is rethrown.
export function teacherDbError(e: unknown): Record<string, string> {
  const code = (e as { code?: string }).code;
  if (code === "23505") return { email: "A teacher with this email is already registered." };
  if (code === "23503") return { subjectIds: "One of the selected subjects no longer exists. Reload and try again." };
  throw e;
}

export async function getTeacher(id: number) {
  const [t] = await sql`
    SELECT t.id, t.full_name, t.date_of_birth::text AS dob, t.email,
      COALESCE(array_agg(ts.subject_id) FILTER (WHERE ts.subject_id IS NOT NULL), '{}') AS subject_ids
    FROM teachers t
    LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
    WHERE t.id = ${id}
    GROUP BY t.id`;
  return t ?? null;
}

export const PAGE_SIZE = 10;

// Filters: name and email are case-insensitive substrings; subjectIds matches teachers teaching ANY of them.
export async function listTeachers({
  name = "",
  email = "",
  subjectIds = [],
  page = 1,
}: {
  name?: string;
  email?: string;
  subjectIds?: number[];
  page?: number;
}) {
  const rows = await sql`
    SELECT t.id, t.full_name, t.date_of_birth::text AS dob, t.email,
      COALESCE(array_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS subjects,
      count(*) OVER() AS total
    FROM teachers t
    LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
    LEFT JOIN subjects s ON s.id = ts.subject_id
    WHERE (${name} = '' OR t.full_name ILIKE ${"%" + name + "%"})
      AND (${email} = '' OR t.email ILIKE ${"%" + email + "%"})
      AND (cardinality(${subjectIds}::int[]) = 0 OR EXISTS (
        SELECT 1 FROM teacher_subjects x WHERE x.teacher_id = t.id AND x.subject_id = ANY(${subjectIds}::int[])))
    GROUP BY t.id
    ORDER BY t.full_name, t.id
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
  return { teachers: rows, total: rows.length ? Number(rows[0].total) : 0 };
}
