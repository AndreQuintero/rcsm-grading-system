# RCSM Grading System — project guide

Admin web app for **Revival Cry School of Ministry**: register and manage teachers, subjects, students,
batches (intakes of students) and admins. Read `AGENTS.md` too: this is Next.js 16, which differs from older versions —
check `node_modules/next/dist/docs/` before using a Next API you are unsure of.

## Stack

- Next.js 16 (App Router, Turbopack) with `cacheComponents: true` and `partialPrefetching: true` (`next.config.ts`).
  Server-action body limit raised to 3 MB for photo uploads.
- React 19, TypeScript, Tailwind CSS v4, shadcn/ui (style "radix-nova", Radix primitives, `lucide-react` icons,
  `sonner` toasts). The shadcn class merger is the `cn` package (`lib/utils.ts` re-exports it).
- Postgres on Neon via `@neondatabase/serverless` (HTTP driver, tagged-template `sql` in `lib/db.ts`).
  **The sandbox and production share the same database.**
- Env vars (see `.env.example`): `DATABASE_URL`, `APP_BASE_URL` (setup links are built from it, never from the request),
  `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` (template params: email, link, name).
- Hosted on Vercel (team `andre-quintero-projects`, project `rcsm-grading-system`).

## Layout

```
app/
  layout.tsx            root shell: SiteHeader sidebar + content, TooltipProvider, Toaster (light, top-right)
  SiteHeader.tsx        charcoal sidebar nav (Teachers, Subjects, Students, Batches, Admins); active link via usePathname in Suspense
  ConfirmDeleteButton   trash icon + AlertDialog; takes a bound server action (+ optional note)
  EditLink              pencil icon link with tooltip
  SubjectMultiSelect    searchable multi-select (chips, keyboard) posting hidden inputs
  <feature>/page.tsx            list page: PageHeader, filter Card (GET form), Table, Pager
  <feature>/new/page.tsx        register page;   <feature>/new/<Feature>Form.tsx  client form (create + edit)
  <feature>/new/actions.ts      create server action;  <feature>/actions.ts  update + delete actions
  <feature>/[id]/edit/page.tsx  edit page (reuses the form)
  students/[id]/photo/route.ts  serves the student photo bytes (stored in Postgres)
  login/, set-password/ public sign-in pages (two-step login; first-password form); account/actions.ts switchRole + logout
  teacher/, student/    role homes (placeholders for now); SessionNav (server) + NavLinks (client) = sidebar per role
proxy.ts                deny-by-default gate: valid DB session + role of the area on every request (Next 16 "middleware")
components/   page-header, pager, filter-actions, form-card, form-message (FieldError), status-badge,
              generic-avatar, use-saved-redirect (toast + router.push to the list after a save), ui/ (shadcn)
lib/auth/     roles (client-safe), sync, session, password (Argon2id), tokens, rate-limit, email (EmailJS), audit, first-sign-in
lib/          db.ts (sql), dates.ts (isRealDate, todayIso), teacher.ts, admin.ts, subject.ts, student.ts (client-safe:
              STATUSES, parseStudent), student-queries.ts (server: listStudents, getStudent), batch.ts
db/           schema.sql (fresh-database schema) and migrations/NNN-*.sql (applied with scripts/migrate.ts)
scripts/      *.test.ts self-checks against the real database; migrate.ts
```

Conventions:
- Validation lives in `lib/*` as pure `parse*` functions; server actions re-validate (never trust the client).
- Forms use `useActionState`; on success they call `useSavedRedirect(listPath)` → toast + redirect to the list.
  Errors stay on the form (`FieldError`, `role="alert"`). Returned `values` re-fill inputs after an error.
- Radio buttons and checkboxes in forms are **native inputs** styled with Tailwind, not Radix: React's form reset
  after an action would leave Radix state out of step with what is submitted.
- Pages that read request data (`searchParams`, `params`, DB reads) wrap that part in `<Suspense>`, or call
  `connection()` — `cacheComponents` refuses to prerender otherwise.
- List filters are GET forms keyed on the active filters (`key={pageHref(1)}`) so "Clear filters" resets inputs.
- Lists are 10 per page using `count(*) OVER()` for the total.
- Update/delete actions call `revalidatePath`; create actions do not (so scripts can call them directly).
- Every export from a `"use server"` file becomes an endpoint — keep plain helpers in `lib/`. **Any action can be posted
  to any path**, so every action starts with `await requireRole("admin")` (or its role); route handlers check
  `getSession()` too. The proxy alone is not enough.
- Create logic lives in `lib/*` (`insertTeacher`, `insertAdmin`, `insertStudent`, `insertSubjects`); the `"use server"`
  action = `requireRole` + that function, so scripts can call the lib function directly.
- Writes to `admins`/`teachers`/`students` call `syncUserFromRoleTables(email)` afterwards (old and new email on an
  email change, `RETURNING email` on delete).
- Design: palette from the logo (charcoal `#2b2e33` sidebar, flame blue `#2e63cf` primary, paper `#f4f6f9`),
  Zilla Slab headings (`font-heading`), Geist body. Light mode only. Full time badge green, audit blue,
  inactive grey. Table headers sentence case, icon actions with tooltips.

## Data model and business rules

- `teachers` (unique email) ↔ `subjects` (unique name) via `teacher_subjects` (many-to-many, cascade both sides).
  A teacher needs at least one subject.
- `students`: first/middle(optional)/last name, date of birth, `status` in `audit | full_time | inactive`,
  `enrollment_date` (required for every status), optional `photo` bytea + `photo_type` (JPEG/PNG/WebP ≤ 2 MB),
  `batch_id` (nullable, `ON DELETE SET NULL`).
- `batches`: `number`, `year` (2000–2100), `semester` (1 or 2). **`UNIQUE (year, semester)`**: a year and
  semester has at most one batch, whatever its number. A duplicate is refused with an error toast naming the
  batch that holds the period (`duplicatePeriodMessage`).
- A student is in **at most one batch**. **Inactive students can be in a batch** (history).
- Batch form offers students with no batch (any status) plus, when editing, the batch's own members.
  Create/update batch is all-or-nothing (division-by-zero guard → code 22012 if a chosen student was taken).
  Deleting a batch keeps its students and frees them.
- **Automatic batch** (`batchPeriod` in `lib/batch.ts`): 1st semester = June–December, 2nd = January–May, in
  the enrollment date's own calendar year. On registration the student joins the matching batch if one
  exists; on edit only if the student has no batch and the enrollment date changed. An edit never moves a
  student out of a batch. The toast says what happened.

- `admins`: full name, email (unique, lowercased), date of birth, `created_at` (registered) and `updated_at`
  (last modified). `updated_at` has no trigger: `updateAdmin` sets it with `updated_at = now()`. Roles come later.
  The list shows both timestamps in UTC; filters are name and email.

- `students.email`: required by the form, nullable in the DB (older rows), unique on `lower(email)`.

### Sign-in (invite-only; see `lib/auth/`)
- People exist only in the role tables. `users` (one per email, `password_hash` NULL = first sign-in pending) and
  `user_roles` (role + `profile_id`, not a real FK) mirror them via `syncUserFromRoleTables` (idempotent, one
  transaction): username from the highest role (admin > teacher > student; students = first middle last); removed
  role or email gone everywhere → role row deleted / user inactive and their sessions deleted.
- `/login` step 1 always answers the same; sync + setup email run in `after()`. Step 2 errors are always
  "Invalid email or password." (dummy Argon2 verify when no user). 5 failures → lock 15 min, doubling.
- Rate limits: 5 per 15 min per IP and per email for each step (`auth_rate_limits`); setup emails 1 per 5 min and
  5 per day (counted from `password_setup_tokens`). IP = first `x-forwarded-for` (trusted only behind Vercel).
- Password rules (`lib/auth/password-rules.ts`, shared by the form and the server): 8–15 characters, a capital
  letter, a lowercase letter, a special character (not a letter, digit or space) and not a common password
  (`@zxcvbn-ts/language-common` list, compared lowercased with symbols removed). The set-password form shows the
  checklist (met items crossed out, animated) and a strength bar; the button stays disabled until all are met.
  Sign-in accepts up to 128 characters so passwords set under the earlier 12–128 rule still work.
- Tokens: `<id>.<32-byte secret>`, SHA-256 stored, 60 min, single use, newer supersedes older; GET `/set-password`
  never touches the DB, the POST consumes it. No auto-login after setting a password.
- Sessions: `sessions` table (id = SHA-256 of the cookie `rcsm_session`), roles re-read every request; idle 30 min /
  absolute 12 h, or 15 min / 8 h when the user holds admin. Role homes: admin `/`, teacher `/teacher`, student `/student`.
- `auth_audit` logs events (never passwords, tokens or links). Security headers + CSP are in `next.config.ts`.
- First admin / repair: `scripts/seed-admin.ts --name … --email … --dob …`; `scripts/backfill-users.ts` re-syncs all.
  **Editing `admins`/`teachers`/`students` directly in SQL skips the sync** (e.g. a changed email leaves the old
  account active): run `scripts/backfill-users.ts` afterwards.

## Running checks in this sandbox

Node's `fetch` (used by the Neon driver) needs the proxy flags here; Vercel does not.

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npx --yes tsx scripts/batches.test.ts
```

Same prefix for `students`, `teachers`, `subjects`, `admins`, `auth` tests and for `scripts/migrate.ts db/migrations/<file>.sql`.
The sign-in browser test starts its own `next start` (run `npm run build` first; emails go to a local outbox file):

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt NODE_PATH=$(npm root -g) NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 node scripts/auth-e2e.test.mjs
```
`npm run build` and `npm run lint` must pass (the build type-checks `scripts/` too). For browser checks, run
`npx next start -p 3100` with the same env prefix and drive it with Playwright (installed globally); stop it
with `pkill -f next-server` (killing `npx` alone leaves the server running).

**Test data rules (shared database with real data):** test batches use years **2085–2100** and are cleaned with
`DELETE FROM batches WHERE year >= 2085`; test students use recognisable last names and enrollment dates in
those years, so they never auto-join a real batch. Test people use `@…test.example.com` emails (`@authtest`,
`@tchtest`, `@admtest`, `@stutest`); clean up their `users` and `auth_audit` rows too (the sync creates them).
Always clean up and confirm real rows are unchanged.
Never register or edit records on the live site.

Network: the sandbox allowlists the Neon hosts (`ep-royal-hall-bd9gqks6-pooler...`, `api.c-8.us-east-2.aws.neon.tech`
— the driver calls the `api.` host), `api.vercel.com`, `ui.shadcn.com` and `api.emailjs.com`. Saving the
environment in the Claude settings UI has dropped a host added by tool before: re-check the list if a host is refused.

Email (EmailJS) troubleshooting — the app logs only the status (`EmailJS send failed with status N`) and writes
`setup_email_sent` / `setup_email_failed` to `auth_audit`:
- 400 "template ID not found": wrong `EMAILJS_TEMPLATE_ID`, or a template from another EmailJS account than the keys.
- 412: the Gmail service in EmailJS lost its authorisation → EmailJS dashboard → Email Services → Reconnect.
- The sandbox's env vars (Claude environment settings) load only when the session starts; edits made mid-session
  are not visible here. Vercel has its own copies (Production/Preview/Development) — to test with those without
  touching production, deploy the branch as a **preview** (`create_deployment` without `target`).
- Never send real emails from tests: the test scripts use `EMAIL_TRANSPORT=outbox`.

## Migrations

Write `db/migrations/NNN-description.sql` (statements end with `;` at line end; one transaction), update
`db/schema.sql` to match, apply with `scripts/migrate.ts`, then verify with a query. Migrations applied so far:
001 teacher_subjects, 002 inquiry→inactive, 003 enrollment date required, 004 batches, 005 unique (year,
semester), 006 admins, 007 auth (users, user_roles, tokens, sessions, rate limits, audit, students.email; followed by
`scripts/backfill-users.ts`). Production uses the same database, so a migration is live immediately — note it in the PR.

## Git, PRs and deployment

- Work on branch `claude/cool-bell-cruur4`; push there. Open a PR into **`develop`** only when the user asks,
  and merge only when asked. No PR template exists. Keep model names out of commits/PRs.
- Before committing: lint, build, self-checks, browser check of the changed flow, scan the diff for secrets.
- Deploy only when asked: the Vercel production branch is not `develop`, so deploy with the Vercel MCP
  `create_deployment` (teamId `team_3kcP2W0ShwMi0Oim9pDsdhht`, project `prj_50rccCSxjXk3X3sRjA2rwQ1Az26G`,
  `target: "production"`, gitSource github `AndreQuintero/rcsm-grading-system` ref `develop`). Poll
  `get_deployment` until READY, confirm `rcsm-grading-system.vercel.app` is in the aliases, then check a page
  with `web_fetch_vercel_url` and `get_runtime_errors`. The site sits behind Vercel deployment protection.

## Working with the user

- Screenshots: send them only for **major** features (the user said not every feature needs one). When you do,
  take them with Playwright at deviceScaleFactor 2, review them, send with SendUserFile, and say clearly when
  they contain temporary test data. For smaller features, report what was verified instead.
- State assumptions and decisions you made; the user corrects rules mid-task (e.g. inactive students in batches).
- Open items: teacher/student areas are placeholders; `develop` does not auto-deploy to production; production needs
  `APP_BASE_URL` and the EmailJS vars before the sign-in deploy, or nobody can get a setup link.
- Graphify MCP tools index this repo (`AndreQuintero/rcsm-grading-system`); check the index commit against
  `git rev-parse HEAD` before trusting it.
