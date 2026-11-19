// Usage: npx tsx scripts/backfill-users.ts
// Creates/updates the sign-in accounts (users + user_roles) for every email in admins, teachers and students,
// and deactivates accounts whose email is in none of them. Safe to run again (the sync is idempotent).
import { sql } from "../lib/db";
import { syncUserFromRoleTables } from "../lib/auth/sync";

(async () => {
  const rows = await sql`
    SELECT lower(btrim(email)) AS email FROM admins
    UNION SELECT lower(btrim(email)) FROM teachers
    UNION SELECT lower(btrim(email)) FROM students WHERE email IS NOT NULL
    UNION SELECT email FROM users`;
  for (const r of rows) await syncUserFromRoleTables(r.email as string);
  const [c] = await sql`SELECT count(*) FILTER (WHERE is_active)::int AS active, count(*)::int AS total FROM users`;
  console.log(`synced ${rows.length} emails; users: ${c.active} active of ${c.total}`);
})().catch((e) => {
  console.error("BACKFILL FAILED:", e.message);
  process.exit(1);
});
