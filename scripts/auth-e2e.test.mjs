// Browser-level checks of the sign-in flow against a real `next start` (items 1-4, 8, 9, 11, 13-16 of the spec).
// Usage (sandbox): NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt NODE_PATH=$(npm root -g) \
//   node scripts/auth-e2e.test.mjs        (after `npm run build`)
// Emails go to a local outbox file (EMAIL_TRANSPORT=outbox), never to EmailJS. Test people use
// @authtest.example.com and are removed at the end.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import argon2 from "argon2";
import { neon } from "@neondatabase/serverless";
import { createRequire } from "node:module";

// Playwright is installed globally (not a project dependency); require() honours NODE_PATH, ESM import does not.
const { chromium, request } = createRequire(import.meta.url)("playwright");

const sql = neon(process.env.DATABASE_URL);
const B = "http://localhost:3100";
const D = "@authtest.example.com";
const APP_BASE_URL = "https://app.example.test";
const PASSWORD = "e2e passphrase that is long enough";
const outbox = join(mkdtempSync(join(tmpdir(), "authe2e-")), "outbox.jsonl");
const E = (n) => `${n}${D}`;
let ipN = 0;
const freshIp = () => `10.77.${Math.floor(++ipN / 250)}.${(ipN % 250) + 1}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log("ok ", m);

const cleanup = async () => {
  await sql`DELETE FROM admins WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM teachers WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM students WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM users WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM auth_audit WHERE email LIKE ${"%" + D} OR ip LIKE '10.77.%'`;
  await sql`DELETE FROM auth_rate_limits WHERE key LIKE ${"%" + D} OR key LIKE '%10.77.%'`;
};
const mails = (email) =>
  existsSync(outbox) ? readFileSync(outbox, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === email) : [];
const waitForMails = async (email, n, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) if (mails(email).length >= n) return mails(email);
  return mails(email);
};

async function fixtures() {
  await sql`INSERT INTO admins (full_name, date_of_birth, email) VALUES
    ('First Login', '1980-01-01', ${E("first")}), ('Multi Admin', '1980-01-01', ${E("multi")}),
    ('Host Test', '1980-01-01', ${E("hostfirst")}), ('Set Pw', '1980-01-01', ${E("setpw")})`;
  await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES
    ('Has Password', '1980-01-01', ${E("haspw")}), ('Multi Teacher', '1980-01-01', ${E("multi")}),
    ('Teacher Only', '1980-01-01', ${E("tonly")}), ('Lock Me', '1980-01-01', ${E("lock")})`;
  await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, email)
    VALUES ('Stu', 'Only', '2000-01-01', 'audit', '2090-08-01', ${E("sonly")})`;
  const emails = ["first", "multi", "hostfirst", "setpw", "haspw", "tonly", "lock", "sonly"].map(E);
  // the app's own sync creates the accounts (same code path as the backfill)
  execFileSync("npx", ["--yes", "tsx", "-e",
    `import { syncUserFromRoleTables } from "./lib/auth/sync"; (async () => { for (const e of ${JSON.stringify(emails)}) await syncUserFromRoleTables(e); })();`],
    { stdio: "ignore" });
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await sql`UPDATE users SET password_hash = ${hash}, password_set_at = now()
    WHERE email = ANY(${["multi", "haspw", "tonly", "lock", "sonly"].map(E)})`;
}

let server;
async function startServer() {
  server = spawn("npx", ["next", "start", "-p", "3100"], {
    env: { ...process.env, APP_BASE_URL, EMAIL_TRANSPORT: "outbox", EMAIL_OUTBOX_FILE: outbox },
    stdio: "ignore",
    detached: true,
  });
  const api = await request.newContext();
  for (let i = 0; i < 60; i++) {
    try {
      if ((await api.get(`${B}/login`)).ok()) return api.dispose();
    } catch {}
    await sleep(500);
  }
  throw new Error("next start did not come up");
}

const normalise = (s, ...emails) => emails.reduce((t, e) => t.split(e).join("<EMAIL>"), s);

// Login step 1 through the real form; returns what the client got back.
async function stepEmail(browser, email, ip = freshIp(), extraHeaders = {}) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip, ...extraHeaders } });
  const page = await ctx.newPage();
  await page.goto(`${B}/login`);
  await page.fill("#email", email);
  const t0 = Date.now();
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"),
    page.click("button[type=submit]"),
  ]);
  const body = await res.text();
  const ms = Date.now() - t0;
  await page.locator("[role=status], [role=alert]").first().waitFor({ timeout: 5000 }).catch(() => {});
  const text = await page.locator("main").innerText({ timeout: 5000 }).catch(() => "");
  return { ctx, page, status: res.status(), body: normalise(body, email), text: normalise(text, email), ms };
}

// Login step 2 (after step 1 in the same page).
async function stepPassword(page, password) {
  await page.fill("#password", password);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login"),
    page.click("button[type=submit]:has-text('Sign in')"),
  ]);
  return res;
}

async function login(browser, email, password = PASSWORD, ip = freshIp()) {
  const r = await stepEmail(browser, email, ip);
  await stepPassword(r.page, password);
  return r;
}
const sessionCookie = async (ctx) => (await ctx.cookies()).find((c) => c.name === "rcsm_session")?.value;
const userId = async (email) => (await sql`SELECT id FROM users WHERE email = ${email}`)[0].id;

(async () => {
  await cleanup();
  await fixtures();
  await startServer();
  const browser = await chromium.launch();
  try {
    // ---- 13. deny by default: every protected route redirects (GET) or 401s (POST) when signed out
    const anon = await request.newContext({ baseURL: B, maxRedirects: 0 });
    const protectedPaths = ["/", "/teachers", "/teachers/new", "/teachers/1/edit", "/subjects", "/subjects/new", "/students", "/students/new",
      "/students/1/photo", "/batches", "/batches/new", "/admins", "/admins/new", "/teacher", "/student", "/no-such-page"];
    for (const p of protectedPaths) {
      const g = await anon.get(p);
      assert.equal(g.status(), 307, `GET ${p}`);
      assert.ok(new URL(g.headers().location, B).pathname === "/login", `GET ${p} -> ${g.headers().location}`);
      assert.equal((await anon.post(p, { data: "x" })).status(), 401, `POST ${p}`);
    }
    assert.equal((await anon.get("/login")).status(), 200);
    assert.equal((await anon.get("/set-password?token=abc")).status(), 200);
    assert.equal((await anon.get("/forgot-password")).status(), 200);
    assert.equal((await anon.get("/icon.png")).status(), 200);
    const h = (await anon.get("/login")).headers();
    assert.match(h["content-security-policy"], /frame-ancestors 'none'/);
    assert.equal(h["x-content-type-options"], "nosniff");
    assert.match(h["strict-transport-security"], /max-age=/);
    assert.equal((await anon.get("/set-password?token=abc")).headers()["referrer-policy"], "no-referrer");
    ok(`13. ${protectedPaths.length} protected routes: GET -> /login, POST -> 401; public pages and assets open; security headers set`);

    // ---- 1. step 1 answers identically for unknown, existing (has password) and first-login emails
    const r1 = [await stepEmail(browser, E("unknown")), await stepEmail(browser, E("haspw")), await stepEmail(browser, E("first"))];
    for (const r of r1.slice(1)) {
      assert.equal(r.status, r1[0].status);
      assert.equal(r.body, r1[0].body, "same action response body");
      assert.equal(r.text, r1[0].text, "same page text");
    }
    assert.match(r1[0].text, /If this is your first sign-in, we've sent a link to your email to set your password\./);
    ok(`1. identical status/body/text for unknown, has-password, first-login (times ms: ${r1.map((r) => r.ms).join(", ")})`);
    for (const r of r1) await r.ctx.close();

    // ---- 2. exactly one setup email for the first-login account; a repeat within 5 minutes sends nothing
    assert.equal((await waitForMails(E("first"), 1)).length, 1);
    assert.equal(mails(E("first"))[0].subject, "First Login RCSM");
    assert.equal(mails(E("haspw")).length + mails(E("unknown")).length, 0, "no email for unknown or has-password");
    const again = await stepEmail(browser, E("first"));
    await again.ctx.close();
    await sleep(2500);
    assert.equal(mails(E("first")).length, 1, "cooldown");
    ok("2. first-login email -> exactly 1 setup email; repeated submit within the cooldown -> still 1");

    // ---- 15. a forged Host / X-Forwarded-Host can't steer the link: it is built from APP_BASE_URL
    const forged = await stepEmail(browser, E("hostfirst"), freshIp(), { "x-forwarded-host": "evil.example.com" });
    await forged.ctx.close();
    const hostMails = await waitForMails(E("hostfirst"), 1, 5000);
    for (const m of [...hostMails, ...mails(E("first"))]) {
      assert.ok(m.link.startsWith(`${APP_BASE_URL}/set-password?token=`), m.link);
      assert.ok(!m.link.includes("evil") && !m.link.includes("localhost"), m.link);
    }
    ok(`15. forged X-Forwarded-Host (status ${forged.status}): ${hostMails.length ? "email sent with the APP_BASE_URL link" : "request refused by the origin check, no email"}; all links use ${APP_BASE_URL}`);

    // ---- 3. step 2: unknown email, wrong password, no password yet -> the same error
    const r3 = [];
    for (const [email, pw] of [[E("nobody"), PASSWORD], [E("haspw"), "wrong password entirely"], [E("first"), PASSWORD]]) {
      const s = await stepEmail(browser, email);
      const res = await stepPassword(s.page, pw);
      await s.page.getByText("Invalid email or password.").waitFor();
      r3.push({ status: res.status(), body: normalise(await res.text(), email), text: normalise(await s.page.locator("main").innerText(), email) });
      assert.equal(await sessionCookie(s.ctx), undefined);
      await s.ctx.close();
    }
    for (const r of r3.slice(1)) assert.deepEqual(r, r3[0]);
    ok("3. unknown email / wrong password / no password yet -> identical 'Invalid email or password.'");

    // ---- 4. correct password: new session id (a planted cookie is replaced), redirect to the highest role's home
    const ctx4 = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    await ctx4.addCookies([{ name: "rcsm_session", value: "planted-fixation-value", url: B }]);
    const p4 = await ctx4.newPage();
    await p4.goto(`${B}/login`);
    await p4.fill("#email", E("multi"));
    await p4.click("button[type=submit]");
    await p4.fill("#password", PASSWORD);
    // the eye toggle shows the password and hides it again
    await p4.getByRole("button", { name: "Show password" }).click();
    assert.equal(await p4.getAttribute("#password", "type"), "text");
    await p4.getByRole("button", { name: "Hide password" }).click();
    assert.equal(await p4.getAttribute("#password", "type"), "password");
    await p4.press("#password", "Enter"); // Enter must sign in, not restart the flow
    await p4.waitForURL(`${B}/`);
    await p4.getByRole("button", { name: "Switch to Teacher" }).waitFor({ timeout: 5000 }); // nav updated without a reload
    const c4 = await sessionCookie(ctx4);
    assert.ok(c4 && c4 !== "planted-fixation-value" && c4.length >= 43, "fresh random session id");
    const multiId = await userId(E("multi"));
    const [s4] = await sql`SELECT active_role::text AS r, count(*) OVER()::int AS n FROM sessions WHERE user_id = ${multiId}`;
    assert.deepEqual([s4.r, s4.n], ["admin", 1]);
    const cookie4 = (await ctx4.cookies()).find((c) => c.name === "rcsm_session");
    assert.equal(cookie4.httpOnly, true);
    assert.equal(cookie4.sameSite, "Lax");
    // signed-in users visiting /login go to their home
    await p4.goto(`${B}/login`);
    assert.equal(p4.url(), `${B}/`);
    // teacher-only and student-only land on their own homes
    const t = await login(browser, E("tonly"));
    await t.page.waitForURL(`${B}/teacher`);
    const s = await login(browser, E("sonly"));
    await s.page.waitForURL(`${B}/student`);
    ok("4. login replaces a planted cookie with a new HttpOnly/SameSite=Lax session; admin+teacher -> /, teacher -> /teacher, student -> /student; /login redirects when signed in");

    // ---- 9. a role's area needs that role (403 otherwise)
    const as = (ctx) => ctx.request;
    for (const [p, code] of [["/teachers", 403], ["/admins/new", 403], ["/teacher", 403], ["/students/1/photo", 403], ["/student", 200]])
      assert.equal((await as(s.ctx).get(`${B}${p}`, { maxRedirects: 0 })).status(), code, `student GET ${p}`);
    assert.equal(new URL((await as(s.ctx).get(`${B}/`, { maxRedirects: 0 })).headers().location, B).pathname, "/student");
    for (const [p, code] of [["/admins", 403], ["/subjects", 403], ["/student", 403], ["/teacher", 200]])
      assert.equal((await as(t.ctx).get(`${B}${p}`, { maxRedirects: 0 })).status(), code, `teacher GET ${p}`);
    // a teacher session can't reach an admin server action by posting it to a public page either
    assert.equal((await as(t.ctx).post(`${B}/teachers/new`, { data: "x", maxRedirects: 0 })).status(), 403);
    ok("9. student-only session: teacher and admin routes 403; teacher-only: admin routes 403");

    // ---- 8. multi-role user switches roles through the navigation
    await p4.goto(`${B}/`);
    await p4.getByRole("button", { name: "Switch to Teacher" }).click();
    await p4.waitForURL(`${B}/teacher`);
    assert.equal((await sql`SELECT active_role::text AS r FROM sessions WHERE user_id = ${multiId}`)[0].r, "teacher");
    await p4.getByRole("button", { name: "Switch to Admin" }).click();
    await p4.waitForURL(`${B}/`);
    assert.equal((await sql`SELECT active_role::text AS r FROM sessions WHERE user_id = ${multiId}`)[0].r, "admin");
    assert.equal(await t.page.getByRole("button", { name: /Switch to/ }).count(), 0, "single-role users get no switcher");
    ok("8. admin+teacher switches to Teacher and back (server-side active_role); single-role users have no switcher");

    // ---- 16. logout destroys the session server-side; the old cookie no longer works
    const before = await sessionCookie(ctx4);
    await p4.getByRole("button", { name: "Sign out" }).click();
    await p4.waitForURL(/\/login$/);
    assert.equal((await sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${multiId}`)[0].n, 0);
    const replay = await browser.newContext();
    await replay.addCookies([{ name: "rcsm_session", value: before, url: B }]);
    const rr = await replay.request.get(`${B}/admins`, { maxRedirects: 0 });
    assert.equal(rr.status(), 307);
    await replay.close();
    ok("16. sign out deletes the session row; replaying the old cookie -> redirect to /login");

    // ---- 11 (+ 10 reuse, 12). set-password: opening the link does not use the token; submitting does, once
    const sp = await stepEmail(browser, E("setpw"));
    await sp.ctx.close();
    const [mail] = await waitForMails(E("setpw"), 1);
    const link = new URL(mail.link);
    const tokenId = Number(link.searchParams.get("token").split(".")[0]);
    const ctx11 = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    const p11 = await ctx11.newPage();
    await p11.goto(`${B}${link.pathname}${link.search}`);
    await p11.goto(`${B}${link.pathname}${link.search}`); // a scanner or a reload opening it twice
    assert.equal((await sql`SELECT used_at FROM password_setup_tokens WHERE id = ${tokenId}`)[0].used_at, null, "GET left the token unused");
    // requirements are listed before typing; each one is ticked off as it is met, and the bar follows
    const submit = p11.locator("button[type=submit]");
    const met = () => p11.locator("li[data-met=true]").count();
    const bar = p11.getByRole("progressbar", { name: "Password strength" });
    assert.equal(await p11.locator("li[data-met]").count(), 5);
    assert.equal(await met(), 0);
    assert.equal(await submit.isDisabled(), true, "nothing typed -> cannot submit");
    for (const [typed, n, label] of [["abc", 2, "Weak"], ["Abc", 3, "Fair"], ["Abc!", 4, "Good"], ["Password1!", 4, "Good"], ["Brand#New9", 5, "Strong"], ["brand#new9", 4, "Good"], ["Brand#New9", 5, "Strong"]]) {
      await p11.fill("#password", typed);
      assert.equal(await met(), n, typed);
      assert.equal(await bar.getAttribute("aria-valuenow"), String(n), typed);
      assert.equal(await bar.getAttribute("aria-valuetext"), label, typed);
      assert.equal(await submit.isDisabled(), n < 5, `${typed}: button enabled only when all 5 are met`);
    }
    // the server checks again: a mismatched confirmation is refused and the link stays usable
    await p11.fill("#confirmPassword", "Brand#New8");
    await p11.click("button[type=submit]");
    await p11.getByText("The passwords don't match.").waitFor();
    assert.equal((await sql`SELECT used_at FROM password_setup_tokens WHERE id = ${tokenId}`)[0].used_at, null, "a rejected password keeps the link usable");
    await p11.fill("#password", "Brand#New9");
    await p11.fill("#confirmPassword", "Brand#New9");
    await p11.click("button[type=submit]");
    await p11.waitForURL(/\/login\?set=1$/);
    await p11.getByText("Your password is set.").waitFor();
    assert.ok((await sql`SELECT used_at FROM password_setup_tokens WHERE id = ${tokenId}`)[0].used_at);
    assert.equal(await sessionCookie(ctx11), undefined, "no auto-login");
    await p11.goto(`${B}${link.pathname}${link.search}`);
    await p11.fill("#password", "Another#9x");
    await p11.fill("#confirmPassword", "Another#9x");
    await p11.click("button[type=submit]");
    await p11.getByText("This link is invalid or has expired. Enter your email on the login page to get a new one.").waitFor();
    await ctx11.close();
    const sp2 = await login(browser, E("setpw"), "Brand#New9");
    await sp2.page.waitForURL(`${B}/`);
    await sp2.ctx.close();
    const sp3 = await stepEmail(browser, E("setpw"));
    await sp3.ctx.close();
    await sleep(2000);
    assert.equal(mails(E("setpw")).length, 1, "no new setup email once the password is set");
    ok("11. GET /set-password (twice) leaves the token unused; POST sets the password, no auto-login; reuse refused; new password signs in; no further setup emails");

    // ---- 14. rate limiting (per IP and per email) and lockout
    const ip14 = freshIp();
    const r14 = [];
    for (let i = 0; i < 7; i++) {
      const r = await stepEmail(browser, E(`burst${i}`), ip14);
      r14.push(r);
      await r.ctx.close();
    }
    const [{ n: ipCount }] = await sql`SELECT count::int AS n FROM auth_rate_limits WHERE key = ${"email:ip:" + ip14}`;
    assert.equal(ipCount, 7);
    for (const r of r14) assert.equal(r.text, r14[0].text, "limited answers look the same");
    const limited = await sql`SELECT count(*)::int AS n FROM auth_audit WHERE event = 'rate_limited' AND ip = ${ip14}`;
    assert.equal(limited[0].n, 2, "attempts 6 and 7 from the same IP were limited");

    const lockId = await userId(E("lock"));
    for (let i = 0; i < 5; i++) {
      const s = await stepEmail(browser, E("lock"));
      await stepPassword(s.page, `wrong password number ${i}`);
      await s.page.getByText("Invalid email or password.").waitFor();
      await s.ctx.close();
    }
    const [lk] = await sql`SELECT failed_login_count, locked_until > now() + interval '14 minutes' AS locked FROM users WHERE id = ${lockId}`;
    assert.deepEqual([lk.failed_login_count, lk.locked], [5, true]);
    await sql`DELETE FROM auth_rate_limits WHERE key LIKE ${"%" + E("lock")}`; // rule out the per-email limit
    const lockedTry = await stepEmail(browser, E("lock"));
    await stepPassword(lockedTry.page, PASSWORD);
    await lockedTry.page.getByText("Invalid email or password.").waitFor();
    assert.equal(await sessionCookie(lockedTry.ctx), undefined, "the right password is refused while locked, with the same message");
    await lockedTry.ctx.close();
    assert.equal((await sql`SELECT count(*)::int AS n FROM auth_audit WHERE event = 'account_locked' AND user_id = ${lockId}`)[0].n, 1);
    // the per-email limit: a 6th password attempt in 15 minutes is refused even with the right password
    await sql`UPDATE users SET locked_until = NULL WHERE id = ${lockId}`;
    for (let i = 0; i < 5; i++) await sql`INSERT INTO auth_rate_limits (key, window_start, count) VALUES (${"password:email:" + E("lock")}, now(), 5) ON CONFLICT (key) DO UPDATE SET count = 5, window_start = now()`;
    const rl = await stepEmail(browser, E("lock"));
    await stepPassword(rl.page, PASSWORD);
    await rl.page.getByText("Invalid email or password.").waitFor();
    assert.equal(await sessionCookie(rl.ctx), undefined);
    await rl.ctx.close();
    // after the lock and the window, the right password works and clears the failure count
    await sql`DELETE FROM auth_rate_limits WHERE key LIKE ${"%" + E("lock")}`;
    const ok14 = await login(browser, E("lock"));
    await ok14.page.waitForURL(`${B}/teacher`);
    await ok14.ctx.close();
    assert.equal((await sql`SELECT failed_login_count FROM users WHERE id = ${lockId}`)[0].failed_login_count, 0);
    ok("14. per-IP limit after 5 (same answer), 5 wrong passwords -> 15-min lock (same message, audited), per-email limit, unlock resets the count");

    // ---- forgotten password: link on the login page, same answer for every email, reset email, new password works
    const fp = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    const fpp = await fp.newPage();
    await fpp.goto(`${B}/login`);
    await fpp.getByRole("link", { name: "I forgot my password" }).click();
    await fpp.waitForURL(`${B}/forgot-password`);
    const forgot = async (email) => {
      await fpp.goto(`${B}/forgot-password`);
      await fpp.fill("#email", email);
      const [res] = await Promise.all([
        fpp.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/forgot-password"),
        fpp.click("button[type=submit]"),
      ]);
      await fpp.getByText("If this email is registered").waitFor();
      return { status: res.status(), body: normalise(await res.text(), email), text: normalise(await fpp.locator("main").innerText(), email) };
    };
    const fr = [await forgot(E("nobody.forgot")), await forgot(E("haspw"))];
    assert.deepEqual(fr[1], fr[0], "unknown and registered emails get the same answer");
    const [resetMail] = await waitForMails(E("haspw"), 1);
    assert.equal(resetMail.subject, "Reset password - RCSM");
    assert.equal(mails(E("nobody.forgot")).length, 0);
    const resetUrl = new URL(resetMail.link);
    await fpp.goto(`${B}${resetUrl.pathname}${resetUrl.search}`);
    await fpp.fill("#password", "Reset#Pass7");
    await fpp.fill("#confirmPassword", "Reset#Pass7");
    await fpp.click("button[type=submit]");
    await fpp.waitForURL(/\/login\?set=1$/);
    await fp.close();
    const oldPw = await stepEmail(browser, E("haspw"));
    await stepPassword(oldPw.page, PASSWORD);
    await oldPw.page.getByText("Invalid email or password.").waitFor();
    await oldPw.ctx.close();
    const newPw = await login(browser, E("haspw"), "Reset#Pass7");
    await newPw.page.waitForURL(`${B}/teacher`);
    await newPw.ctx.close();
    ok("forgot password: link on login, identical answer for unknown/registered, 'Reset password - RCSM' email, old password refused, new one signs in");

    console.log("all auth e2e checks passed");
  } finally {
    await browser.close();
    try { process.kill(-server.pid); } catch {}
    await cleanup();
  }
})().catch((e) => {
  console.error("AUTH E2E FAILED:", e);
  try { process.kill(-server.pid); } catch {}
  process.exit(1);
});
