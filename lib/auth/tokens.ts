import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

export const TOKEN_TTL_MINUTES = 60;

// setup: first sign-in (account has no password yet). reset: forgotten password (may replace the password).
export type TokenPurpose = "setup" | "reset";
const sha256 = (s: string) => createHash("sha256").update(s).digest();

// The emailed link is built only from APP_BASE_URL, never from the request (Host headers can be forged).
export function setupLink(token: string): string {
  const base = process.env.APP_BASE_URL;
  if (!base || !/^https?:\/\//.test(base)) throw new Error("APP_BASE_URL is not configured");
  const url = new URL("/set-password", base);
  url.searchParams.set("token", token);
  return url.toString();
}

// Issues a single-use token "<id>.<secret>" (32 random bytes, base64url); only SHA-256(secret) is stored.
// Older unused tokens of the user stop working. Returns null when the email limits apply:
// at most one per 5 minutes and 5 per day per user.
export async function issueSetupToken(userId: number, purpose: TokenPurpose = "setup"): Promise<string | null> {
  const secret = randomBytes(32).toString("base64url");
  const hash = sha256(secret).toString("hex");
  // Locking the user row first serialises concurrent requests, so the limit check sees every earlier token.
  const [, rows] = await sql.transaction([
    sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
    sql`
      WITH recent AS (
        SELECT count(*) FILTER (WHERE created_at > now() - interval '5 minutes') AS last5,
               count(*) FILTER (WHERE created_at > now() - interval '1 day') AS last_day
        FROM password_setup_tokens WHERE user_id = ${userId}
      ),
      allowed AS (SELECT 1 FROM recent WHERE last5 = 0 AND last_day < 5),
      superseded AS (
        UPDATE password_setup_tokens SET used_at = now()
        WHERE user_id = ${userId} AND used_at IS NULL AND EXISTS (SELECT 1 FROM allowed)
      )
      INSERT INTO password_setup_tokens (user_id, token_hash, purpose, expires_at)
      SELECT ${userId}, ${hash}, ${purpose}, now() + make_interval(mins => ${TOKEN_TTL_MINUTES}) FROM allowed
      RETURNING id`,
  ]);
  return rows.length ? `${rows[0].id}.${secret}` : null;
}

function parseToken(token: string): { id: number; secret: string } | null {
  const m = /^(\d{1,10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  return m ? { id: Number(m[1]), secret: m[2] } : null;
}

// Checks a token without using it up: well formed, hash matches (constant time), unused, not expired.
export async function checkSetupToken(token: string): Promise<{ id: number; hash: string } | null> {
  const t = parseToken(token);
  if (!t) return null;
  const [row] = await sql`SELECT token_hash FROM password_setup_tokens
    WHERE id = ${t.id} AND used_at IS NULL AND expires_at > now()`;
  if (!row) return null;
  const expected = Buffer.from(row.token_hash as string, "hex");
  const given = sha256(t.secret);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { id: t.id, hash: row.token_hash as string } : null;
}

// Uses the token to set the password, in one statement: the token must still be unused and unexpired, and the
// user active; a setup link also needs the account to have no password yet (a reset link may replace it).
// Marks the token used, clears any lockout and ends the user's sessions. Returns false otherwise.
export async function consumeSetupToken(token: string, passwordHash: string): Promise<boolean> {
  const t = await checkSetupToken(token);
  if (!t) return false;
  const rows = await sql`
    WITH tok AS (
      SELECT id, user_id, purpose FROM password_setup_tokens
      WHERE id = ${t.id} AND token_hash = ${t.hash} AND used_at IS NULL AND expires_at > now()
      FOR UPDATE
    ),
    pic AS (
      SELECT photo, photo_type FROM (
        SELECT 1 AS k, photo, photo_type, email FROM admins
        UNION ALL SELECT 2, photo, photo_type, email FROM teachers
        UNION ALL SELECT 3, photo, photo_type, email FROM students
      ) x
      WHERE photo IS NOT NULL AND lower(email) = (SELECT email FROM users WHERE id = (SELECT user_id FROM tok))
      ORDER BY k LIMIT 1
    ),
    used AS (UPDATE password_setup_tokens SET used_at = now() WHERE id IN (SELECT id FROM tok)),
    u AS (
      UPDATE users SET password_hash = ${passwordHash}, password_set_at = now(),
        failed_login_count = 0, locked_until = NULL, updated_at = now(),
        -- first sign-in only (no password yet): the avatar is copied from admins, then teachers, then students
        photo = CASE WHEN users.password_hash IS NULL THEN pic.photo ELSE users.photo END,
        photo_type = CASE WHEN users.password_hash IS NULL THEN pic.photo_type ELSE users.photo_type END
      FROM tok LEFT JOIN pic ON true
      WHERE users.id = tok.user_id AND users.is_active AND users.disabled_at IS NULL AND (users.password_hash IS NULL OR tok.purpose = 'reset')
      RETURNING users.id, users.email, tok.purpose
    ),
    ended AS (DELETE FROM sessions WHERE user_id IN (SELECT id FROM u)),
    logged AS (INSERT INTO auth_audit (event, user_id, email, detail) SELECT 'password_set', id, email, jsonb_build_object('purpose', purpose) FROM u)
    SELECT id FROM u`;
  return rows.length > 0;
}
