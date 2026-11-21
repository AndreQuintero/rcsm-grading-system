import { sql } from "@/lib/db";

export const USER_PAGE_SIZE = 10;

// inactive = blocked by an admin; pending = no password set yet (first sign-in not done). An account whose email
// left every role table is deleted by the sync, so every listed user has a role.
export type UserStatus = "active" | "inactive" | "pending";
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending first sign-in",
};

const fmt = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')`;
export const USER_STATUS_SQL = `CASE WHEN u.disabled_at IS NOT NULL THEN 'inactive'
  WHEN u.password_hash IS NULL THEN 'pending' ELSE 'active' END`;
const ROLES = `coalesce((SELECT array_agg(r.role::text ORDER BY r.role) FROM user_roles r WHERE r.user_id = u.id), '{}')`;

export const isUserStatus = (s: string): s is UserStatus => Object.hasOwn(USER_STATUS_LABEL, s);

export async function listUsers({ username = "", email = "", status = "", page = 1 }: { username?: string; email?: string; status?: UserStatus | ""; page?: number }) {
  const rows = await sql.query(
    `SELECT u.id, u.username, u.email, ${ROLES} AS roles, ${USER_STATUS_SQL} AS status, u.photo IS NOT NULL AS has_photo,
       ${fmt("u.created_at")} AS created, count(*) OVER() AS total
     FROM users u
     WHERE ($1 = '' OR u.username ILIKE '%' || $1 || '%') AND ($2 = '' OR u.email ILIKE '%' || $2 || '%')
       AND ($4 = '' OR ${USER_STATUS_SQL} = $4)
     ORDER BY u.username, u.id
     LIMIT ${USER_PAGE_SIZE} OFFSET $3`,
    [username, email, (page - 1) * USER_PAGE_SIZE, status],
  );
  return { users: rows, total: rows.length ? Number(rows[0].total) : 0 };
}

export async function getUser(id: number) {
  const [u] = await sql.query(
    `SELECT u.id, u.username, u.email, ${ROLES} AS roles, ${USER_STATUS_SQL} AS status, u.photo IS NOT NULL AS has_photo,
       ${fmt("u.created_at")} AS created, ${fmt("u.password_set_at")} AS password_set, ${fmt("u.disabled_at")} AS disabled,
       CASE WHEN u.locked_until > now() THEN ${fmt("u.locked_until")} END AS locked_until,
       (SELECT ${fmt("max(a.created_at)")} FROM auth_audit a WHERE a.user_id = u.id AND a.event = 'login_success') AS last_login
     FROM users u WHERE u.id = $1`,
    [id],
  );
  return u ?? null;
}

// Blocking also ends the user's sessions (lookupSession would refuse them anyway). Returns the email, or null if
// there is no such user.
export async function setUserDisabled(id: number, disabled: boolean): Promise<string | null> {
  const [u] = await sql`
    UPDATE users SET disabled_at = CASE WHEN ${disabled}::boolean THEN coalesce(disabled_at, now()) END, updated_at = now()
    WHERE id = ${id} RETURNING email`;
  if (u && disabled) await sql`DELETE FROM sessions WHERE user_id = ${id}`;
  return (u?.email as string) ?? null;
}
