import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { teacherCanSeeStudent, teacherIdForUser } from "@/lib/grading";

// A student's photo for a teacher who teaches in a semester the student's batch is in.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  const teacherId = s?.roles.includes("teacher") ? await teacherIdForUser(s.userId) : null;
  if (!teacherId) return new Response("Forbidden", { status: 403 });
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n < 1 || !(await teacherCanSeeStudent(teacherId, n))) return new Response("Not found", { status: 404 });
  const [r] = await sql`SELECT encode(photo, 'base64') AS b64, photo_type FROM students WHERE id = ${n}`;
  if (!r?.b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(r.b64 as string, "base64"), {
    headers: { "Content-Type": r.photo_type as string, "Cache-Control": "private, no-cache" },
  });
}
