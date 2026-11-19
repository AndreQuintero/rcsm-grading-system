import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "@/lib/db";
import { isRole, type Role } from "@/lib/auth/roles";

export const SESSION_COOKIE = "rcsm_session";

// Idle / absolute timeouts. Holding the admin role makes the whole session use the stricter pair.
export const TIMEOUTS = { admin: { idleMinutes: 15, absoluteHours: 8 }, other: { idleMinutes: 30, absoluteHours: 12 } };

const sessionId = (token: string) => createHash("sha256").update(token).digest("hex");

export type Session = { id: string; userId: number; username: string; email: string; activeRole: Role; roles: Role[]; stale: boolean; hasPhoto: boolean };

// Validates a cookie token against the database: user active, roles read fresh (a removed role counts at once),
// active role still held, idle and absolute timeouts not passed. No Next request APIs, so proxy.ts can use it.
export async function lookupSession(token: string | undefined): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const [row] = await sql`
    SELECT s.id, s.user_id, s.active_role::text AS active_role, u.username, u.email, u.photo IS NOT NULL AS has_photo,
      array_agg(r.role::text ORDER BY r.role) AS roles,
      s.last_seen_at < now() - interval '1 minute' AS stale
    FROM sessions s
    JOIN users u ON u.id = s.user_id AND u.is_active
    JOIN user_roles r ON r.user_id = u.id
    WHERE s.id = ${sessionId(token)}
    GROUP BY s.id, u.id
    HAVING bool_or(r.role = s.active_role)
      AND s.last_seen_at > now() - CASE WHEN bool_or(r.role = 'admin')
        THEN make_interval(mins => ${TIMEOUTS.admin.idleMinutes}) ELSE make_interval(mins => ${TIMEOUTS.other.idleMinutes}) END
      AND s.created_at > now() - CASE WHEN bool_or(r.role = 'admin')
        THEN make_interval(hours => ${TIMEOUTS.admin.absoluteHours}) ELSE make_interval(hours => ${TIMEOUTS.other.absoluteHours}) END`;
  if (!row) return null;
  return {
    id: row.id as string,
    userId: row.user_id as number,
    username: row.username as string,
    email: row.email as string,
    activeRole: row.active_role as Role,
    roles: (row.roles as string[]).filter(isRole),
    stale: row.stale as boolean,
    hasPhoto: row.has_photo as boolean,
  };
}

// Sliding idle timeout: written at most once a minute per session.
export async function touchSession(id: string) {
  await sql`UPDATE sessions SET last_seen_at = now() WHERE id = ${id}`;
}

// Changes the active role only to a role the user holds (checked in the same statement). Returns false otherwise.
export async function changeActiveRole(id: string, role: string): Promise<boolean> {
  if (!isRole(role)) return false;
  const rows = await sql`
    UPDATE sessions s SET active_role = ${role}::user_role
    WHERE s.id = ${id} AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = s.user_id AND r.role = ${role}::user_role)
    RETURNING s.id`;
  return rows.length > 0;
}

// Current request's session (cached for the request). Server components, actions and route handlers.
export const getSession = cache(async () => lookupSession((await cookies()).get(SESSION_COOKIE)?.value));

// Server-side guard for actions, route handlers and pages: signed in and holding the role.
export async function requireRole(role: Role): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.roles.includes(role)) throw new Error("Forbidden");
  return s;
}

// Starts a fresh session (new random id) and drops the one the browser carried, if any.
export async function createSession(userId: number, activeRole: Role, isAdmin: boolean) {
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("base64url");
  await sql.transaction([
    ...(previous ? [sql`DELETE FROM sessions WHERE id = ${sessionId(previous)}`] : []),
    // old rows of this user past the longest absolute timeout are dead; clear them while here
    sql`DELETE FROM sessions WHERE user_id = ${userId} AND created_at < now() - make_interval(hours => ${TIMEOUTS.other.absoluteHours})`,
    sql`INSERT INTO sessions (id, user_id, active_role) VALUES (${sessionId(token)}, ${userId}, ${activeRole}::user_role)`,
  ]);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: (isAdmin ? TIMEOUTS.admin : TIMEOUTS.other).absoluteHours * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM sessions WHERE id = ${sessionId(token)}`;
  jar.delete(SESSION_COOKIE);
}
