import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { studentCanSeeTeacher } from "@/lib/student-records";

// A teacher's photo for a student that teacher teaches (a subject that grades the student).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s?.roles.includes("student")) return new Response("Forbidden", { status: 403 });
  const [me] = await sql`SELECT profile_id FROM user_roles WHERE user_id = ${s.userId} AND role = 'student'`;
  const n = Number((await params).id);
  if (!me || !Number.isInteger(n) || n < 1 || !(await studentCanSeeTeacher(me.profile_id as number, n))) return new Response("Not found", { status: 404 });
  const [r] = await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM teachers WHERE id = ${n}`;
  if (!r?.b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r.b64 as string, "base64"), { headers: { "Content-Type": r.photo_type as string, "Cache-Control": "private, no-cache" } });
}
