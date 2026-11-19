import { sql } from "@/lib/db";

export const SUBJECT_PAGE_SIZE = 10;

// Name filter is a case-insensitive substring match.
export async function listSubjectPage({ name = "", page = 1 }: { name?: string; page?: number }) {
  const rows = await sql`
    SELECT id, name, count(*) OVER() AS total
    FROM subjects
    WHERE (${name} = '' OR name ILIKE ${"%" + name + "%"})
    ORDER BY name, id
    LIMIT ${SUBJECT_PAGE_SIZE} OFFSET ${(page - 1) * SUBJECT_PAGE_SIZE}`;
  return { subjects: rows, total: rows.length ? Number(rows[0].total) : 0 };
}

// Every subject, for pickers and filters.
export async function allSubjects(): Promise<{ id: number; name: string }[]> {
  const rows = await sql`SELECT id, name FROM subjects ORDER BY name`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

export async function getSubject(id: number) {
  const [s] = await sql`SELECT id, name FROM subjects WHERE id = ${id}`;
  return s ?? null;
}

export type SubjectFormState = { errors?: string; message?: string };

// Adds the names that are new and reports the ones that already existed.
export async function insertSubjects(names: string[]): Promise<SubjectFormState> {
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
