// Library-level checks of the sign-in rules against the real database (items 2, 5, 6, 7, 8, 10, 12, 14, 15 of the spec).
// Test people use @authtest.example.com emails and are removed at the end; real rows are never touched.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "../lib/db";
import { syncUserFromRoleTables } from "../lib/auth/sync";
import { hashPassword, parsePassword, verifyPassword } from "../lib/auth/password";
import { checkSetupToken, consumeSetupToken, issueSetupToken, setupLink } from "../lib/auth/tokens";
import { hit } from "../lib/auth/rate-limit";
import { changeActiveRole, lookupSession } from "../lib/auth/session";
import { startFirstSignIn } from "../lib/auth/first-sign-in";
import { highestRole, requiredRole, safeNext } from "../lib/auth/roles";
import { createHash } from "node:crypto";

const D = "@authtest.example.com";
const outbox = join(mkdtempSync(join(tmpdir(), "authtest-")), "outbox.jsonl");
process.env.APP_BASE_URL = "https://app.example.test";
process.env.EMAIL_TRANSPORT = "outbox";
process.env.EMAIL_OUTBOX_FILE = outbox;

const cleanup = async () => {
  await sql`DELETE FROM admins WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM teachers WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM students WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM users WHERE email LIKE ${"%" + D}`; // cascades roles, tokens, sessions
  await sql`DELETE FROM auth_audit WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM auth_rate_limits WHERE key LIKE ${"%authtest%"}`;
};
const admin = (name: string, email: string) => sql`INSERT INTO admins (full_name, date_of_birth, email) VALUES (${name}, '1980-01-01', ${email}) RETURNING id`;
const teacher = (name: string, email: string) => sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES (${name}, '1980-01-01', ${email}) RETURNING id`;
const student = (first: string, last: string, email: string) =>
  sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, email) VALUES (${first}, ${last}, '2000-01-01', 'audit', '2090-08-01', ${email}) RETURNING id`;
const user = async (email: string) => {
  const [u] = await sql`SELECT u.id, u.username, u.is_active, u.password_hash, coalesce(array_agg(r.role::text ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
    FROM users u LEFT JOIN user_roles r ON r.user_id = u.id WHERE u.email = ${email} GROUP BY u.id`;
  return u;
};
const newSession = async (userId: number, role: string, lastSeenAgo = "0 minutes", createdAgo = "0 minutes") => {
  const token = `tok-${Math.random()}`;
  const id = createHash("sha256").update(token).digest("hex");
  await sql`INSERT INTO sessions (id, user_id, active_role, created_at, last_seen_at)
    VALUES (${id}, ${userId}, ${role}::user_role, now() - ${createdAgo}::interval, now() - ${lastSeenAgo}::interval)`;
  return token;
};
const sentTo = (email: string) => (existsSync(outbox) ? readFileSync(outbox, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === email) : []);

(async () => {
  await cleanup();
  try {
    // ---- pure helpers
    assert.equal(highestRole(["student", "teacher"]), "teacher");
    assert.equal(requiredRole("/teachers"), "admin");
    assert.equal(requiredRole("/teacher"), "teacher");
    assert.equal(requiredRole("/teacher/grades"), "teacher");
    assert.equal(requiredRole("/students/5/photo"), "admin");
    assert.equal(requiredRole("/student"), "student");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", "/a\nb"]) assert.equal(safeNext(bad, "/home"), "/home", bad);
    assert.equal(safeNext("/teachers?page=2", "/"), "/teachers?page=2");
    console.log("ok  helpers: role areas, safe redirect targets");

    // ---- password rules
    const pw = (p: string, c = p) => { const f = new FormData(); f.set("password", p); f.set("confirmPassword", c); return parsePassword(f); };
    assert.match(pw("short").errors?.password ?? "", /12/);
    assert.match(pw("x".repeat(129)).errors?.password ?? "", /128/);
    assert.match(pw("qwertyuiop123").errors?.password ?? "", /common/);
    assert.ok(pw("a perfectly fine passphrase", "different").errors?.confirmPassword);
    assert.equal(pw("a perfectly fine passphrase").password, "a perfectly fine passphrase");
    const h = await hashPassword("a perfectly fine passphrase");
    assert.match(h, /^\$argon2id\$/);
    assert.equal(await verifyPassword(h, "a perfectly fine passphrase"), true);
    assert.equal(await verifyPassword(h, "wrong"), false);
    console.log("ok  password rules: 12-128, confirmation, common list, Argon2id");

    // ---- 5. username priority
    const only = `only.teacher${D}`;
    await teacher("Tina Teacher", only);
    await syncUserFromRoleTables(` ${only.toUpperCase()} `); // matched case-insensitively after trimming
    assert.equal((await user(only)).username, "Tina Teacher");

    const ta = `teacher.admin${D}`;
    await teacher("TA as Teacher", ta);
    await admin("TA as Admin", ta);
    await syncUserFromRoleTables(ta);
    assert.equal((await user(ta)).username, "TA as Admin");

    const st = `student.teacher${D}`;
    await student("ST", "as Student", st);
    await teacher("ST as Teacher", st);
    await syncUserFromRoleTables(st);
    assert.equal((await user(st)).username, "ST as Teacher");

    const all3 = `all.three${D}`;
    await student("A3", "as Student", all3);
    await teacher("A3 as Teacher", all3);
    await admin("A3 as Admin", all3);
    await syncUserFromRoleTables(all3);
    assert.equal((await user(all3)).username, "A3 as Admin");
    console.log("ok  5. username: teacher only / teacher+admin / student+teacher / all three");

    // ---- 6. one users row, one role row per table, one password
    assert.equal((await sql`SELECT count(*)::int AS n FROM users WHERE email = ${ta}`)[0].n, 1);
    assert.deepEqual((await user(ta)).roles, ["admin", "teacher"]);
    assert.deepEqual((await user(all3)).roles, ["admin", "teacher", "student"]);
    assert.equal((await user(ta)).password_hash, null);
    // sync is idempotent: running it again changes nothing and logs nothing new
    const auditBefore = (await sql`SELECT count(*)::int AS n FROM auth_audit WHERE email = ${ta}`)[0].n;
    await syncUserFromRoleTables(ta);
    await syncUserFromRoleTables(ta);
    assert.equal((await sql`SELECT count(*)::int AS n FROM auth_audit WHERE email = ${ta}`)[0].n, auditBefore);
    assert.deepEqual((await user(ta)).roles, ["admin", "teacher"]);
    console.log("ok  6. email in two tables -> 1 user, 2 roles, 1 password; sync idempotent");

    // ---- 7. sync follows the role tables
    await sql`UPDATE admins SET full_name = 'TA Renamed' WHERE email = ${ta}`;
    await syncUserFromRoleTables(ta);
    assert.equal((await user(ta)).username, "TA Renamed");
    const taUser = await user(ta);
    const s1 = await newSession(taUser.id, "admin");
    assert.ok(await lookupSession(s1));
    await sql`DELETE FROM admins WHERE email = ${ta}`;
    await syncUserFromRoleTables(ta);
    assert.deepEqual((await user(ta)).roles, ["teacher"]);
    assert.equal((await user(ta)).username, "TA as Teacher");
    assert.equal(await lookupSession(s1), null, "removing a role ends the user's sessions");
    const s2 = await newSession(taUser.id, "teacher");
    await sql`DELETE FROM teachers WHERE email = ${ta}`;
    await syncUserFromRoleTables(ta);
    const gone = await user(ta);
    assert.equal(gone.is_active, false);
    assert.deepEqual(gone.roles, []);
    assert.equal(await lookupSession(s2), null);
    assert.equal((await sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${taUser.id}`)[0].n, 0);
    const events = (await sql`SELECT event FROM auth_audit WHERE email = ${ta} ORDER BY id`).map((r) => r.event);
    assert.ok(events.includes("role_added") && events.includes("role_removed") && events.includes("user_deactivated"), events.join());
    console.log("ok  7. rename -> username; removed from one table -> role gone + sessions ended; from all -> inactive");

    // ---- 8. role switching only to held roles
    const a3 = await user(all3);
    const s3 = await newSession(a3.id, "admin");
    const s3id = (await lookupSession(s3))!.id;
    assert.equal(await changeActiveRole(s3id, "teacher"), true);
    assert.equal((await lookupSession(s3))!.activeRole, "teacher");
    const tOnly = await user(only);
    const s4 = await newSession(tOnly.id, "teacher");
    const s4id = (await lookupSession(s4))!.id;
    assert.equal(await changeActiveRole(s4id, "admin"), false, "a teacher cannot switch to admin");
    assert.equal(await changeActiveRole(s4id, "superuser"), false);
    assert.equal((await lookupSession(s4))!.activeRole, "teacher");
    console.log("ok  8. switch to a held role works; to a role not held is refused");

    // ---- session timeouts (admin role: idle 15 min / absolute 8 h; others: 30 min / 12 h)
    assert.equal(await lookupSession(await newSession(a3.id, "admin", "16 minutes")), null);
    assert.ok(await lookupSession(await newSession(tOnly.id, "teacher", "16 minutes")));
    assert.equal(await lookupSession(await newSession(tOnly.id, "teacher", "31 minutes")), null);
    assert.equal(await lookupSession(await newSession(a3.id, "admin", "1 minute", "9 hours")), null);
    assert.ok(await lookupSession(await newSession(tOnly.id, "teacher", "1 minute", "9 hours")));
    assert.equal(await lookupSession(await newSession(tOnly.id, "teacher", "1 minute", "13 hours")), null);
    console.log("ok  session idle/absolute timeouts (stricter when the user holds admin)");

    // ---- 2 + 15. first sign-in email: exactly one, cooldown, link from APP_BASE_URL
    const first = `first.login${D}`;
    await admin("First Login", first);
    assert.equal(await startFirstSignIn(first), "sent");
    assert.equal(await startFirstSignIn(first), "none", "cooldown: one email per 5 minutes");
    const mails = sentTo(first);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].name, "First Login");
    assert.ok(mails[0].link.startsWith("https://app.example.test/set-password?token="), mails[0].link);
    assert.equal(setupLink("x").startsWith("https://app.example.test/"), true);
    // daily cap: 5 per day
    const fu = await user(first);
    await sql`UPDATE password_setup_tokens SET created_at = now() - interval '6 minutes' WHERE user_id = ${fu.id}`;
    for (let i = 0; i < 4; i++) {
      assert.ok(await issueSetupToken(fu.id), `token ${i + 2} of the day`);
      await sql`UPDATE password_setup_tokens SET created_at = created_at - interval '6 minutes' WHERE user_id = ${fu.id}`;
    }
    assert.equal(await issueSetupToken(fu.id), null, "6th email of the day is refused");
    // unknown email and a user who already has a password get nothing
    assert.equal(await startFirstSignIn(`nobody${D}`), "none");
    assert.equal(await user(`nobody${D}`), undefined);
    console.log("ok  2. one setup email, 5-minute cooldown, 5/day cap; 15. link built from APP_BASE_URL");

    // ---- 10. tokens: expired, reused, tampered, superseded
    await sql`DELETE FROM password_setup_tokens WHERE user_id = ${fu.id}`;
    const pwHash = await hashPassword("correct horse battery staple");
    const old = (await issueSetupToken(fu.id))!;
    await sql`UPDATE password_setup_tokens SET created_at = now() - interval '6 minutes' WHERE user_id = ${fu.id}`;
    const fresh = (await issueSetupToken(fu.id))!;
    assert.equal(await checkSetupToken(old), null, "older token superseded by a newer one");
    const tampered = fresh.slice(0, -1) + (fresh.endsWith("A") ? "B" : "A");
    assert.equal(await checkSetupToken(tampered), null, "tampered secret");
    assert.equal(await checkSetupToken("1.short"), null, "malformed");
    assert.equal(await checkSetupToken(`${Number(fresh.split(".")[0]) + 999999}.${fresh.split(".")[1]}`), null, "unknown id");
    await sql`UPDATE password_setup_tokens SET expires_at = now() - interval '1 second' WHERE id = ${Number(fresh.split(".")[0])}`;
    assert.equal(await consumeSetupToken(fresh, pwHash), false, "expired");
    await sql`UPDATE password_setup_tokens SET created_at = now() - interval '6 minutes' WHERE user_id = ${fu.id}`;
    const good = (await issueSetupToken(fu.id))!;
    assert.ok(await checkSetupToken(good));
    assert.equal((await sql`SELECT used_at FROM password_setup_tokens WHERE id = ${Number(good.split(".")[0])}`)[0].used_at, null, "checking does not use it up");
    assert.equal(await consumeSetupToken(good, pwHash), true);
    assert.equal(await consumeSetupToken(good, pwHash), false, "reused");
    console.log("ok  10. expired, reused, tampered, malformed and superseded tokens are refused");

    // ---- 12. after setting a password the account is no longer a first login
    const done = await user(first);
    assert.ok(done.password_hash);
    assert.equal(await verifyPassword(done.password_hash, "correct horse battery staple"), true);
    await sql`UPDATE password_setup_tokens SET created_at = now() - interval '2 days' WHERE user_id = ${fu.id}`;
    const before = sentTo(first).length;
    assert.equal(await startFirstSignIn(first), "none");
    assert.equal(sentTo(first).length, before, "no new email once the password is set");
    // a password-set user can't be given a second password through an old valid token either
    const another = (await issueSetupToken(fu.id))!;
    assert.equal(await consumeSetupToken(another, await hashPassword("another long passphrase")), false);
    console.log("ok  12. password set -> no longer first login (no email, tokens can't overwrite it)");

    // ---- 14 (counter part). 5 attempts per 15 minutes per key, then refused; window resets
    const key = `password:email:limit${D}`;
    for (let i = 1; i <= 5; i++) assert.equal(await hit(key), true, `attempt ${i}`);
    assert.equal(await hit(key), false, "6th attempt in the window");
    await sql`UPDATE auth_rate_limits SET window_start = now() - interval '16 minutes' WHERE key = ${key}`;
    assert.equal(await hit(key), true, "new window");
    console.log("ok  14. rate limit counter: 5 per 15 minutes per key, then refused; resets after the window");

    console.log("all auth library checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("AUTH CHECK FAILED:", e);
  process.exit(1);
});
