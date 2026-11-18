// Usage: npx tsx scripts/migrate.ts db/migrations/001-teacher-subjects.sql
// Runs every statement of the file in a single transaction (all or nothing).
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) throw new Error("Pass the migration file path");
const sql = neon(process.env.DATABASE_URL!);

// shortcut: splits on ";" at line end, so statements must not contain that sequence inside strings or bodies.
const statements = readFileSync(file, "utf8")
  .replace(/--.*$/gm, "")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

sql
  .transaction(statements.map((s) => sql.query(s)))
  .then(() => console.log(`applied ${statements.length} statements from ${file}`))
  .catch((e) => {
    console.error("MIGRATION FAILED (nothing was applied):", e.message);
    process.exit(1);
  });
