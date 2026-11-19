import { sql } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/roles";

// Every role-table row whose email matches $1, with its priority (admin > teacher > student) and display name.
const FOUND = `found AS (
  SELECT DISTINCT ON (role) role, prio, profile_id, name FROM (
    SELECT 'admin'::user_role AS role, 1 AS prio, id AS profile_id, full_name AS name FROM admins WHERE lower(btrim(email)) = $1
    UNION ALL SELECT 'teacher', 2, id, full_name FROM teachers WHERE lower(btrim(email)) = $1
    UNION ALL SELECT 'student', 3, id, concat_ws(' ', first_name, middle_name, last_name) FROM students WHERE lower(btrim(email)) = $1
  ) m ORDER BY role, profile_id
)`;

// Makes users/user_roles match the role tables for one email, in one transaction. Idempotent.
// - creates the user (no password yet) or updates the username from the highest-priority table;
// - adds/removes user_roles so they match exactly; a removed role ends that user's sessions;
// - an email found nowhere deactivates the user (row kept) and ends their sessions.
export async function syncUserFromRoleTables(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email) return;
  await sql.transaction([
    sql.query(
      `WITH ${FOUND},
      best AS (SELECT name FROM found ORDER BY prio LIMIT 1),
      up AS (
        INSERT INTO users (email, username) SELECT $1, name FROM best
        ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, is_active = true, updated_at = now()
          WHERE users.username IS DISTINCT FROM EXCLUDED.username OR NOT users.is_active
        RETURNING id
      ),
      off AS (
        UPDATE users SET is_active = false, updated_at = now()
        WHERE email = $1 AND is_active AND NOT EXISTS (SELECT 1 FROM found)
        RETURNING id
      ),
      off_audit AS (INSERT INTO auth_audit (event, user_id, email) SELECT 'user_deactivated', id, $1 FROM off),
      off_sessions AS (DELETE FROM sessions WHERE user_id IN (SELECT id FROM off))
      SELECT 1`,
      [email],
    ),
    sql.query(
      `WITH ${FOUND},
      gone AS (
        DELETE FROM user_roles r USING users u
        WHERE r.user_id = u.id AND u.email = $1 AND NOT EXISTS (SELECT 1 FROM found f WHERE f.role = r.role)
        RETURNING r.user_id, r.role
      ),
      gone_audit AS (
        INSERT INTO auth_audit (event, user_id, email, detail)
        SELECT 'role_removed', user_id, $1, jsonb_build_object('role', role) FROM gone
      ),
      gone_sessions AS (DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM gone))
      SELECT 1`,
      [email],
    ),
    sql.query(
      `WITH ${FOUND},
      added AS (
        INSERT INTO user_roles (user_id, role, profile_id)
        SELECT u.id, f.role, f.profile_id FROM users u CROSS JOIN found f WHERE u.email = $1
        ON CONFLICT (user_id, role) DO UPDATE SET profile_id = EXCLUDED.profile_id
          WHERE user_roles.profile_id IS DISTINCT FROM EXCLUDED.profile_id
        RETURNING user_id, role, (xmax = 0) AS inserted
      )
      INSERT INTO auth_audit (event, user_id, email, detail)
      SELECT 'role_added', user_id, $1, jsonb_build_object('role', role) FROM added WHERE inserted`,
      [email],
    ),
  ]);
}
