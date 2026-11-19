import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// Serves a student's photo bytes; the photo is stored in the database, not on disk.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // the proxy already checks this; a route handler checks again for itself
  if (!(await getSession())?.roles.includes("admin")) return new Response("Forbidden", { status: 403 });
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n < 1) return new Response("Not found", { status: 404 });

  const [r] = await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM students WHERE id = ${n}`;
  if (!r?.b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r.b64 as string, "base64"), {
    headers: { "Content-Type": r.photo_type as string, "Cache-Control": "private, no-cache" },
  });
}
