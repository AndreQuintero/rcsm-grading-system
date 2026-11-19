import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// The signed-in user's own avatar (users.photo); any role may fetch only their own.
export async function GET() {
  const s = await getSession();
  if (!s) return new Response("Unauthorized", { status: 401 });
  const [r] = await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM users WHERE id = ${s.userId}`;
  if (!r?.b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r.b64 as string, "base64"), {
    headers: { "Content-Type": r.photo_type as string, "Cache-Control": "private, no-cache" },
  });
}
