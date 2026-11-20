// Checks of the Users page library (list, details, inactivate/reactivate) against the real database.
// Test people use @authtest.example.com emails and are removed at the end; real rows are never touched.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "../lib/db";
import { syncUserFromRoleTables } from "../lib/auth/sync";
import { hashPassword } from "../lib/auth/password";
import { consumeSetupToken, issueSetupToken } from "../lib/auth/tokens";
import { lookupSession } from "../lib/auth/session";
import { startPasswordReset } from "../lib/auth/first-sign-in";
import { getUser, isUserStatus, listUsers, setUserDisabled, USER_PAGE_SIZE } from "../lib/user";

const D = "@authtest.example.com";
const outbox = join(mkdtempSync(join(tmpdir(), "userstest-")), "outbox.jsonl");
process.env.APP_BASE_URL = "https://app.example.test";
process.env.EMAIL_TRANSPORT = "outbox";
process.env.EMAIL_OUTBOX_FILE = outbox;

const cleanup = async () => {
  await sql`DELETE FROM admins WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM teachers WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM users WHERE email LIKE ${"%" + D}`; // cascades roles, tokens, sessions
  await sql`DELETE FROM auth_audit WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM auth_rate_limits WHERE key LIKE ${"%authtest%"}`;
};
const newSession = async (userId: number) => {
  const token = `tok-${Math.random()}`;
  await sql`INSERT INTO sessions (id, user_id, active_role) VALUES (${createHash("sha256").update(token).digest("hex")}, ${userId}, 'teacher')`;
  return token;
};
const sent = (email: string) => (existsSync(outbox) ? readFileSync(outbox, "utf8").split("\n").filter((l) => l.includes(email)).length : 0);

(async () => {
  await cleanup();
  try {
    // 12 teachers -> 12 accounts, enough for two pages under a username filter
    for (let i = 1; i <= 12; i++) {
      const email = `u${String(i).padStart(2, "0")}${D}`;
      await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES (${`Usrtest Person ${String(i).padStart(2, "0")}`}, '1980-01-01', ${email})`;
      await syncUserFromRoleTables(email);
    }
    const p1 = await listUsers({ username: "usrtest person" });
    assert.equal(p1.total, 12);
    assert.equal(p1.users.length, USER_PAGE_SIZE);
    assert.equal(p1.users[0].username, "Usrtest Person 01");
    assert.deepEqual(p1.users[0].roles, ["teacher"]);
    assert.equal(p1.users[0].status, "pending");
    assert.equal((await listUsers({ username: "usrtest person", page: 2 })).users.length, 2);
    assert.equal((await listUsers({ email: "u07@authtest" })).total, 1);
    assert.equal((await listUsers({ username: "usrtest", email: "nobody-here" })).total, 0);
    // % and _ in a filter are matched literally enough not to error
    assert.ok((await listUsers({ username: "%_'" })).total >= 0);

    // a user with a password and a session
    const email = `u01${D}`;
    const [u] = await sql`UPDATE users SET password_hash = ${await hashPassword("Usrtest!Pw1")}, password_set_at = now() WHERE email = ${email} RETURNING id`;
    const id = u.id as number;
    const token = await newSession(id);
    assert.ok(await lookupSession(token));
    let d = await getUser(id);
    assert.equal(d.status, "active");
    assert.equal(d.last_login, null);
    assert.equal(d.disabled, null);
    assert.equal(await getUser(2147483000), null);

    // inactivate: sessions end, status shows, sign-in links are not sent or usable
    const reset = await issueSetupToken(id, "reset");
    assert.equal(await setUserDisabled(id, true), email);
    assert.equal(await lookupSession(token), null);
    assert.equal((await sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${id}`)[0].n, 0);
    d = await getUser(id);
    assert.equal(d.status, "inactive");
    assert.ok(d.disabled);
    assert.equal(await consumeSetupToken(reset!, await hashPassword("Other!Pw22")), false);
    assert.equal(await startPasswordReset(email), "none");
    assert.equal(sent(email), 0);
    // a fresh session is refused too (the check is in lookupSession, not only the delete)
    assert.equal(await lookupSession(await newSession(id)), null);

    // an edit of the role-table record (which runs the sync) keeps the block
    await sql`UPDATE teachers SET full_name = 'Usrtest Person 01 Edited' WHERE email = ${email}`;
    await syncUserFromRoleTables(email);
    assert.equal((await getUser(id)).status, "inactive");

    // reactivate
    assert.equal(await setUserDisabled(id, false), email);
    d = await getUser(id);
    assert.equal(d.status, "active");
    assert.equal(d.disabled, null);
    assert.ok(await lookupSession(await newSession(id)));
    assert.equal(await setUserDisabled(2147483000, true), null);

    // removed from every role table -> "no roles"
    await sql`DELETE FROM teachers WHERE email = ${`u12${D}`}`;
    await syncUserFromRoleTables(`u12${D}`);
    const [r] = (await listUsers({ email: `u12${D}` })).users;
    assert.equal(r.status, "no_roles");

    // status filter: 12 accounts = 1 active, 1 no roles, 10 pending
    const count = (status: "active" | "inactive" | "no_roles" | "pending") => listUsers({ username: "usrtest person", status }).then((x) => x.total);
    assert.deepEqual([await count("active"), await count("no_roles"), await count("pending"), await count("inactive")], [1, 1, 10, 0]);
    await setUserDisabled(id, true);
    assert.deepEqual([await count("active"), await count("inactive")], [0, 1]);
    assert.ok(isUserStatus("pending") && !isUserStatus("toString") && !isUserStatus(""));
    assert.deepEqual(r.roles, []);

    console.log("all users checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
