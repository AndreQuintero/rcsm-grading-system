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

export async function getSubject(id: number) {
  const [s] = await sql`SELECT id, name FROM subjects WHERE id = ${id}`;
  return s ?? null;
}
