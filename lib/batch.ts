import { sql } from "@/lib/db";
import { parseIds } from "@/lib/teacher";

export const BATCH_PAGE_SIZE = 10;

// 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd"
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export const batchLabel = (b: { number: number; year: number; semester: number }) =>
  `${ordinal(b.number)} batch, ${b.year} – ${ordinal(b.semester)} semester`;

export type BatchInput = { number: number; year: number; semester: 1 | 2; studentIds: number[] };

export type BatchParse =
  | { data: BatchInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined };

// Validates untrusted form input; the server action re-runs this, so the client is not trusted.
export function parseBatch(formData: FormData): BatchParse {
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const int = (k: string) => (/^\d+$/.test(text(k)) ? Number(text(k)) : NaN);
  const number = int("number");
  const year = int("year");
  const semester = int("semester");
  const studentIds = parseIds(formData.getAll("studentIds"));

  const errors: Record<string, string> = {};
  if (!(number >= 1 && number <= 999)) errors.number = "Enter a batch number from 1 to 999.";
  if (!(year >= 2000 && year <= 2100)) errors.year = "Enter a year between 2000 and 2100.";
  if (semester !== 1 && semester !== 2) errors.semester = "Choose the 1st or 2nd semester.";

  if (Object.keys(errors).length) return { errors };
  return { data: { number, year, semester: semester as 1 | 2, studentIds } };
}

// Raw fields, used to re-fill the form after an error (student ids joined so checkboxes can be re-checked).
export function batchValues(formData: FormData): Record<string, string> {
  return {
    number: String(formData.get("number") ?? ""),
    year: String(formData.get("year") ?? ""),
    semester: String(formData.get("semester") ?? ""),
    studentIds: parseIds(formData.getAll("studentIds")).join(","),
  };
}

// Maps Postgres errors the user can fix to form errors; anything else is rethrown.
export function batchDbError(e: unknown): Record<string, string> {
  const code = (e as { code?: string }).code;
  if (code === "23505") return { number: "That batch already exists for this year and semester." };
  if (code === "22012")
    return { studentIds: "Some selected students are no longer available (inactive or already in a batch). Reload and try again." };
  if (code === "23503") return { form: "This batch no longer exists." };
  throw e;
}

// Students who can join a batch: not inactive and in no batch yet. When editing, the batch's own members too.
export async function eligibleStudents(batchId: number | null = null) {
  const rows = await sql`
    SELECT id, concat_ws(' ', first_name, middle_name, last_name) AS name, status,
      date_part('year', age(current_date, date_of_birth))::int AS age, photo IS NOT NULL AS has_photo
    FROM students
    WHERE (status <> 'inactive' AND batch_id IS NULL) OR batch_id = ${batchId}
    ORDER BY last_name, first_name, id`;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    status: r.status as string,
    age: r.age as number,
    hasPhoto: r.has_photo as boolean,
  }));
}

// Inserts the batch and assigns its students in one statement, so both happen or neither does.
export async function createBatch({ number, year, semester, studentIds }: BatchInput): Promise<number> {
  const [row] = await sql`
    WITH b AS (
      INSERT INTO batches (number, year, semester) VALUES (${number}, ${year}, ${semester}) RETURNING id
    ), u AS (
      UPDATE students SET batch_id = (SELECT id FROM b)
      WHERE id = ANY(${studentIds}::int[]) AND status <> 'inactive' AND batch_id IS NULL
      RETURNING id
    )
    -- Division by zero (22012) aborts the whole statement when a chosen student was not available.
    SELECT (SELECT id FROM b) AS id,
      (SELECT count(*) FROM u) / (CASE WHEN (SELECT count(*) FROM u) = ${studentIds.length}::int THEN 1 ELSE 0 END) AS assigned`;
  return row.id as number;
}

// Updates the batch and replaces its member list in one transaction. Returns false if the batch is gone.
export async function updateBatch(id: number, { number, year, semester, studentIds }: BatchInput): Promise<boolean> {
  const [updated] = await sql.transaction([
    sql`UPDATE batches SET number = ${number}, year = ${year}, semester = ${semester} WHERE id = ${id} RETURNING id`,
    sql`UPDATE students SET batch_id = NULL WHERE batch_id = ${id} AND NOT (id = ANY(${studentIds}::int[]))`,
    sql`WITH u AS (
          UPDATE students SET batch_id = ${id}
          WHERE id = ANY(${studentIds}::int[])
            AND ((status <> 'inactive' AND batch_id IS NULL) OR batch_id = ${id})
          RETURNING id
        )
        -- Division by zero (22012) rolls the transaction back when a chosen student was not available.
        SELECT count(*) / (CASE WHEN count(*) = ${studentIds.length}::int THEN 1 ELSE 0 END) AS assigned FROM u`,
  ]);
  return updated.length > 0;
}

export async function getBatch(id: number) {
  const [b] = await sql`
    SELECT b.id, b.number, b.year, b.semester,
      COALESCE(array_agg(s.id) FILTER (WHERE s.id IS NOT NULL), '{}') AS student_ids
    FROM batches b LEFT JOIN students s ON s.batch_id = b.id
    WHERE b.id = ${id}
    GROUP BY b.id`;
  return b ?? null;
}

// number and year are exact matches; null means "any".
export async function listBatches({ number = null, year = null, page = 1 }: { number?: number | null; year?: number | null; page?: number }) {
  const rows = await sql`
    SELECT b.id, b.number, b.year, b.semester,
      (SELECT count(*) FROM students s WHERE s.batch_id = b.id)::int AS students,
      count(*) OVER() AS total
    FROM batches b
    WHERE (${number}::int IS NULL OR b.number = ${number}) AND (${year}::int IS NULL OR b.year = ${year})
    ORDER BY b.year DESC, b.semester DESC, b.number DESC, b.id DESC
    LIMIT ${BATCH_PAGE_SIZE} OFFSET ${(page - 1) * BATCH_PAGE_SIZE}`;
  return { batches: rows, total: rows.length ? Number(rows[0].total) : 0 };
}
