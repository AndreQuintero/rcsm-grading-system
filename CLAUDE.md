# RCSM Grading System — project guide

Admin web app for **Revival Cry School of Ministry**: register and manage teachers, subjects, students,
batches (intakes of students), academic semesters and admins, see the sign-in accounts (Users), with an admin dashboard at `/`. Read `AGENTS.md` too: this is Next.js 16, which differs from older versions —
check `node_modules/next/dist/docs/` before using a Next API you are unsure of.

## Stack

- Next.js 16 (App Router, Turbopack) with `cacheComponents: true` and `partialPrefetching: true` (`next.config.ts`).
  Server-action body limit raised to 3 MB for photo uploads.
- React 19, TypeScript, Tailwind CSS v4, shadcn/ui (style "radix-nova", Radix primitives, `lucide-react` icons,
  `sonner` toasts). The shadcn class merger is the `cn` package (`lib/utils.ts` re-exports it).
- Postgres on Neon via `@neondatabase/serverless` (HTTP driver, tagged-template `sql` in `lib/db.ts`).
  **The sandbox and production share the same database.**
- Env vars (see `.env.example`): `DATABASE_URL`, `APP_BASE_URL` (setup links are built from it, never from the request),
  `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` (template params: email, link, name, subject).
- Hosted on Vercel (team `andre-quintero-projects`, project `rcsm-grading-system`).

## Layout

```
app/
  page.tsx              admin dashboard (`/`): hero (student count + status bar, Lottie), stat row (teachers, subjects, admins,
                        active users), semester picker (?semester=id; default = running today, else latest started, else nearest
                        future — `pickDefault` in lib/dashboard.ts, 2nd semester Jan–May precedes 1st Jun–Dec), teachers (bottom
                        Sheet drawer with that semester's subjects), one panel per batch (non-inactive students, each linking to
                        /student-records/<id>/<semester>), empty state;
                        client bits in app/_dashboard/ (SemesterSelect = shadcn Select pill, TeacherList, Avatar)
  layout.tsx            root shell: SiteHeader sidebar + content, TooltipProvider, Toaster (light, top-right)
  SiteHeader.tsx        charcoal sidebar nav (Teachers, Subjects, Students, Student records, Batches, Semesters, Admins, Users); active link via usePathname in Suspense;
                        below md a top bar with a burger: MobileMenu (components/ui/sheet, slides in from the right) shows the
                        same SessionNav pieces (account card, links, switch role, sign out) and closes on navigation;
                        the session menu is hidden on the public sign-in pages (HideOnPublicPages, PUBLIC_PATHS in lib/auth/roles.ts,
                        shared with the proxy) because the root layout stays mounted when an expired session redirects to /login
  ConfirmDeleteButton   trash icon + AlertDialog; takes a bound server action (+ optional note)
  EditLink              pencil icon link with tooltip
  SubjectMultiSelect    searchable multi-select (chips, keyboard) posting hidden inputs (semester form: one per teacher)
  <feature>/page.tsx            list page: PageHeader, filter Card (GET form), Table, Pager
  <feature>/new/page.tsx        register page;   <feature>/new/<Feature>Form.tsx  client form (create + edit)
  <feature>/new/actions.ts      create server action;  <feature>/actions.ts  update + delete actions
  <feature>/[id]/edit/page.tsx  edit page (reuses the form)
  <students|teachers|admins|users>/[id]/photo/route.ts  serve the optional photo bytes (stored in Postgres, admin only) via lib/photo-response.ts
  login/, set-password/, forgot-password/  public pages (two-step login; password form for both link kinds; reset request);
  account/               any signed-in user's own page (menu avatar/name links here): username + avatar edit, email
                        read-only, member since, role tags, change password (current + new, same rules/checklist); actions.ts also
                        switchRole + logout; photo/route.ts the user's avatar (?v= cache-buster from users.updated_at)
  academic-semesters/    list (year filter) + register/edit (AcademicSemesterForm: year + semester radios, batch cards,
                        teacher rows each with a SubjectMultiSelect posted as subjects-<teacherId>) + delete
  student-records/      admin "Student records": all students (name/email/batch incl. "No batch"/status filters, 10 per page);
                        [studentId] = hero (Calendar booking Lottie) + semester cards (graded count, total average, % of points)
                        plus a first "All semesters" card, or a no-semesters state; [studentId]/[semesterId] = record
                        (semesterId "all" = every semester combined: cards tagged with their semester, bars averaged across
                        semesters, picker option "All semesters") (dashboard-style semester row: Calendar booking Lottie, period,
                        graded count, and the SemesterSelect pill with pathTemplate over the student's semesters, always shown; StudentHero, GradeAverages, one card per subject with grades + its teachers +
                        comment, ScoreBars + ScoreGauge, no-grades state)
  users/                 admin view of sign-in accounts (users table): list (username/email filters) + [id] details; no register/
                        edit/delete — only Inactivate/Reactivate (ActiveToggle, AlertDialog + toast; not for your own account)
  teacher/gradings/     teacher area (menu: Home, Gradings, Score records): semester picker (?semester=, same default rule as the dashboard,
                        over the teacher's own semesters) + subject cards; [semesterId]/[subjectId] binds the semester's
                        batches (BatchBinder; removing asks for confirmation) and, once a batch is added, shows 5 class averages
                        (gradeAverages: per type over students who have it, total over students with ≥ 1 grade) above the students; .../[studentId] = student card + GradeForm
                        (4 grades, live total, comment). Every page/action: requireTeacher() + teaches(semester, subject)
  teacher/records/      "Score records": the teacher's students across all semesters (name/batch/semester filters, 10 per page,
                        inactive included; empty state links to Gradings); [studentId] = record: hero (Data Analysis Lottie),
                        GradeAverages, grades per semester+subject, ScoreBars (avg total per subject, CSS tooltip + sr-only
                        table) and ScoreGauge (points earned / possible for the grades given) from components/records/
  teacher/students/[id]/photo  student photo for a teacher the student is "assigned" to (same rule as score records)
  teacher/page.tsx      teacher home: welcome + semester (picker over their semesters, default rule as the dashboard), stat row
                        (subjects, batches added, students, % fully graded), grading progress per subject, pending work
                        (subjects with no batch, students missing grades by type), class performance (ScoreBars) and up to 4 lowest
                        scores so far at ≤ 90% (ATTENTION_MAX_PCT) of points given (homeSummary) linking to records; no semester → empty state
  student/              student home (placeholder); SessionNav (server) + NavLinks (client, menu per role) = sidebar
proxy.ts                deny-by-default gate: valid DB session + role of the area on every request (Next 16 "middleware")
components/   records/ (GradeAverages = 5-indicator row, ScoreBars, ScoreGauge, StudentHero; shared by the teacher and admin
              record pages), lottie-player (LottiePlayer by name; lottie-web light player, no eval for the CSP; each JSON in components/lottie/ is
              its own chunk), empty-animation ("nothing found" above every empty table message), ridge (logo mountain shape), photo-picker (optional photo on student/teacher/admin forms), page-header, pager, filter-actions, form-card, form-message (FieldError), status-badge, skeletons (list/form/header loading placeholders),
              generic-avatar, use-saved-redirect (toast + router.push to the list after a save), ui/ (shadcn; sheet = side panels, right for the mobile menu and bottom for the dashboard drawer, sliding their full size;
              select = the dashboard semester picker)
lib/auth/     roles (client-safe), sync, session, password (Argon2id), password-rules, tokens, rate-limit, email (EmailJS), audit,
              first-sign-in, account (own profile + change password; account-shared = client-safe types)
lib/          student-records.ts (admin: listStudentRecords, studentRecordBatches, studentSemesters, studentSemesterRecord),
              grading.ts (server: requireTeacher, teacherSemesters, teacherSubjects, subjectGrading, studentGrading,
              bind/unbindBatch, saveGrades, teacherStudents, teacherStudentFilters, studentRecord; ASSIGNED = a teacher's students:
              in a batch bound to one of their subjects, or graded in one), grading-shared.ts (client-safe: GRADE_TYPES, parseGrades,
              gradeTotal, gradeAverages, subjectAverages, overallScore, homeSummary), dashboard.ts (counts, semesterChoices, pickDefault, semesterDetail), academic-semester.ts (parse, create/update, get, list, semesterOptions), user.ts (listUsers, getUser, setUserDisabled), db.ts (sql), dates.ts (isRealDate, todayIso), teacher.ts, admin.ts, subject.ts, student.ts (client-safe:
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

- Students, teachers and admins have an optional `photo` bytea + `photo_type` (JPEG/PNG/WebP ≤ 2 MB; `lib/photo.ts`
  parses it; an update keeps it unless a new file or "Remove current photo" is sent). Lists don't load or show it.
- `teachers` (unique email) and `subjects` (unique name) are not linked directly: what a teacher teaches is set per
  **academic semester** (the old `teacher_subjects` table is dropped by migration 013).
- `academic_semesters`: `year` (2000–2100) + `semester` (1/2), **`UNIQUE (year, semester)`** (duplicate → error toast +
  alert). `academic_semester_batches`: any batches, several per semester, and a batch can be in many semesters; the
  students take part through their batch. `academic_semester_teacher_subjects` (semester, teacher, subject): a teacher
  is in the semester when they have ≥ 1 subject there; a subject may go to several teachers. Batches and teachers are
  optional (plan first, fill later). All FKs cascade: deleting a batch/teacher/subject removes it from semesters;
  deleting a semester keeps them. Create is one statement, update one transaction (replace the link rows).
- **Gradings** (migration 014): `subject_batches` (semester, subject, batch) and `grades` (semester, subject, student:
  `midterm`, `participation`, `presence`, `final_exam` each whole 0–25 or NULL = not given, `comment` ≤ 2000, `updated_by`).
  Keyed by semester + subject, so every teacher of that subject in that semester shares batches and grades (last save
  wins, "Last saved by" shown). Only the semester's batches can be bound; a student is graded when their batch is bound
  and still in the semester and they are not inactive. Unbinding keeps grades. Total = sum of given grades / 100.
- **Score records**: a teacher's students = in a batch bound to one of their (semester, subject), or graded in one
  (inactive included; a later unbinding keeps graded students listed). The record's gauge counts 25 possible points per
  grade given, so a half-graded subject isn't shown as half failed; the bar chart averages a subject's totals across semesters.
- **Student records** (admin): a student's semesters = those including their batch, plus any with their grades; a
  semester's subjects = their batch bound to the subject (batch still in the semester) or graded in it — the score-records
  rule without a teacher filter. Each subject shows every teacher of it in that semester.
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
  (last modified). `updated_at` has no trigger: `updateAdmin` sets it with `updated_at = now()`. Admin/teacher/student roles are derived from which table holds the email.
  The list shows both timestamps in UTC; filters are name and email.

- `students.email`: required by the form, nullable in the DB (older rows), unique on `lower(email)`.

### Sign-in (invite-only; see `lib/auth/`)
- People exist only in the role tables. `users` (one per email, `password_hash` NULL = first sign-in pending) and
  `user_roles` (role + `profile_id`, not a real FK) mirror them via `syncUserFromRoleTables` (idempotent, one
  transaction): username from the highest role (admin > teacher > student; students = first middle last); removed
  role or email gone everywhere → role row deleted / user inactive and their sessions deleted.
- **Inactive (admin block)**: `users.disabled_at`, set on the Users page. It is separate from `is_active`, which the sync
  owns and would undo. Every `is_active` check also requires `disabled_at IS NULL` (session lookup, token use, setup/reset
  emails, account). Inactivating deletes the user's sessions. Login step 2 says "Your account is inactive…" only after the
  correct password; a wrong password still gets the generic error.
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
  never touches the DB, the POST consumes it. No auto-login after setting a password. `purpose`: `setup` (first
  sign-in, only if the account has no password) or `reset` (forgotten password, may replace it; also clears a lockout).
- Same EmailJS template for both: `subject` = "First Login RCSM" (setup) or "Reset password - RCSM" (reset)
  (`EMAIL_SUBJECT` in `lib/auth/first-sign-in.ts`). `/forgot-password` answers the same for every email; an account
  that never set a password gets the first sign-in email from it. Cooldown/day cap are shared by both kinds.
- Sessions: `sessions` table (id = SHA-256 of the cookie `rcsm_session`), roles re-read every request; idle 30 min /
  absolute 12 h, or 15 min / 8 h when the user holds admin. Role homes: admin `/`, teacher `/teacher`, student `/student`.
- Avatar: `users.photo`/`photo_type`, copied **once** when the first password is set (`consumeSetupToken`, only if
  the account had no password): admins → teachers → students, first with a photo. Independent afterwards (role-table
  photo edits and password resets don't touch it). Sidebar shows it from `/account/photo` (own avatar, any role —
  `requiredRole` returns null for `/account/*`), else `GenericAvatar`.
- Username and avatar belong to the user once the first password is set: the sync only overwrites `username`
  while `password_hash` is NULL. Changing the password (`lib/auth/account.ts`) needs the current one, is rate
  limited per user, must differ from the current one, and ends the user's other sessions (this one stays).
- `auth_audit` logs events (never passwords, tokens or links). Security headers + CSP are in `next.config.ts`.
- First admin / repair: `scripts/seed-admin.ts --name … --email … --dob …`; `scripts/backfill-users.ts` re-syncs all.
  **Editing `admins`/`teachers`/`students` directly in SQL skips the sync** (e.g. a changed email leaves the old
  account active): run `scripts/backfill-users.ts` afterwards.

## Running checks in this sandbox

Node's `fetch` (used by the Neon driver) needs the proxy flags here; Vercel does not.

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npx --yes tsx scripts/batches.test.ts
```

Same prefix for `student-records`, `gradings`, `dashboard`, `students`, `teachers`, `subjects`, `batches`, `academic-semesters`, `admins`, `users`, `auth` tests and for `scripts/migrate.ts db/migrations/<file>.sql`.
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
`scripts/backfill-users.ts`), 008 token purpose (setup | reset), 009 admin/teacher photos, 010 users.photo (avatar), 011 users.disabled_at (admin block), 012 academic semesters, 013 drop teacher_subjects (applied after
the deploy that stopped reading it), 014 gradings (subject_batches, grades). A migration that removes something production code still reads must wait
for that code's deploy, since the database is shared. Production uses the same database, so a migration is live immediately — note it in the PR.

## Git, PRs and deployment

- Work on branch `claude/cool-bell-cruur4`; push there. Open a PR into **`develop`** only when the user asks,
  and merge only when asked. No PR template exists. Keep model names out of commits/PRs.
- Before committing: lint, build, self-checks, browser check of the changed flow, scan the diff for secrets.
- The Vercel production branch is **`develop`**: merging a PR into `develop` deploys to production by itself, and
  pushes to the working branch only make previews. After a merge, check the new production deployment (below).
  A manual redeploy, only when asked: Vercel MCP `create_deployment` (teamId `team_3kcP2W0ShwMi0Oim9pDsdhht`, project `prj_50rccCSxjXk3X3sRjA2rwQ1Az26G`,
  `target: "production"`, gitSource github `AndreQuintero/rcsm-grading-system` ref `develop`). Poll
  `get_deployment` until READY, confirm `rcsm-grading-system.vercel.app` is in the aliases, then check a page
  with `web_fetch_vercel_url` and `get_runtime_errors`. The site sits behind Vercel deployment protection.

## Working with the user

- Screenshots: send them only for **major** features (the user said not every feature needs one). When you do,
  take them with Playwright at deviceScaleFactor 2, review them, send with SendUserFile, and say clearly when
  they contain temporary test data. For smaller features, report what was verified instead.
- State assumptions and decisions you made; the user corrects rules mid-task (e.g. inactive students in batches).
- Open items: the student area is a placeholder (teachers have Home, Gradings, Score records); production needs `APP_BASE_URL` and the EmailJS vars, or nobody can
  get a setup link.
- Graphify MCP tools index this repo (`AndreQuintero/rcsm-grading-system`); check the index commit against
  `git rev-parse HEAD` before trusting it.
