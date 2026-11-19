import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// Serves a stored photo; photos live in the database, not on disk. Admin only (the proxy checks too).
export async function servePhoto(table: "admins" | "teachers" | "students" | "users", idParam: Promise<{ id: string }>) {
  if (!(await getSession())?.roles.includes("admin")) return new Response("Forbidden", { status: 403 });
  const n = Number((await idParam).id);
  if (!Number.isInteger(n) || n < 1) return new Response("Not found", { status: 404 });

  // table names cannot be query parameters, so each is a fixed statement
  const [r] =
    table === "admins" ? await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM admins WHERE id = ${n}`
    : table === "teachers" ? await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM teachers WHERE id = ${n}`
    : table === "students" ? await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM students WHERE id = ${n}`
    : await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM users WHERE id = ${n}`;
  if (!r?.b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r.b64 as string, "base64"), {
    headers: { "Content-Type": r.photo_type as string, "Cache-Control": "private, no-cache" },
  });
}
