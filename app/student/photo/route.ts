import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// The signed-in student's own student photo (their record's picture, not the account avatar).
export async function GET() {
  const s = await getSession();
  if (!s?.roles.includes("student")) return new Response("Forbidden", { status: 403 });
  const [r] = await sql`
    SELECT encode(st.photo, 'base64') AS b64, st.photo_type FROM user_roles ur JOIN students st ON st.id = ur.profile_id
    WHERE ur.user_id = ${s.userId} AND ur.role = 'student'`;
  if (!r?.b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r.b64 as string, "base64"), { headers: { "Content-Type": r.photo_type as string, "Cache-Control": "private, no-cache" } });
}
