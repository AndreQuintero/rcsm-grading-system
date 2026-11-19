import { sql } from "@/lib/db";

// Security events for later review. Never pass passwords, tokens or links here.
export async function audit(
  event: string,
  { userId = null, email = null, ip = null, detail = null }: { userId?: number | null; email?: string | null; ip?: string | null; detail?: Record<string, unknown> | null } = {},
) {
  await sql`INSERT INTO auth_audit (event, user_id, email, ip, detail)
    VALUES (${event}, ${userId}, ${email}, ${ip}, ${detail ? JSON.stringify(detail) : null}::jsonb)`;
}
