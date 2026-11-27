CREATE TABLE IF NOT EXISTS teachers (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  email text NOT NULL UNIQUE,
  photo bytea,
  photo_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Batches group students by intake: the Nth batch of a year, in its 1st or 2nd semester.
-- A year and semester can have only one batch.
CREATE TABLE IF NOT EXISTS batches (
  id serial PRIMARY KEY,
  number int NOT NULL CHECK (number > 0),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester int NOT NULL CHECK (semester IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, semester)
);

-- Every student has an enrollment date.
CREATE TABLE IF NOT EXISTS students (
  id serial PRIMARY KEY,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  status text NOT NULL CHECK (status IN ('audit', 'full_time', 'inactive')),
  enrollment_date date NOT NULL,
  photo bytea,
  photo_type text,
  batch_id int REFERENCES batches(id) ON DELETE SET NULL, -- at most one batch per student
  email text, -- required by the form; NULL only for students registered before sign-in existed
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON students (lower(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_batch_idx ON students (batch_id);

-- Admins who manage the system (roles will come later). updated_at is set by the update action.
CREATE TABLE IF NOT EXISTS admins (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  date_of_birth date NOT NULL,
  photo bytea,
  photo_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sign-in (see lib/auth). users + user_roles mirror the role tables.
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');

-- One row per person (email). password_hash NULL = first sign-in not completed.
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  username text NOT NULL,
  password_hash text,
  password_set_at timestamptz,
  failed_login_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  is_active boolean NOT NULL DEFAULT true, -- legacy: the sync now deletes an account whose email left every role table
  disabled_at timestamptz, -- set by an admin (Users page): blocks sign-in; the sync never touches it
  photo bytea, -- avatar copied from admins → teachers → students at the first password set; independent afterwards
  photo_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- profile_id points at admins/teachers/students depending on role, so it cannot be a foreign key; the sync keeps it right.
CREATE TABLE IF NOT EXISTS user_roles (
  id serial PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  profile_id int NOT NULL,
  UNIQUE (user_id, role)
);

-- Only the SHA-256 of the secret part of a token is stored.
CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id serial PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'setup' CHECK (purpose IN ('setup', 'reset')), -- reset may replace a password
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_setup_tokens_user_idx ON password_setup_tokens (user_id, created_at);

-- Server-side sessions; id is the SHA-256 of the cookie token.
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_role user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'password' CHECK (method IN ('password', 'passkey'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Biometric sign-in (WebAuthn passkeys).
-- One row per enrolled device. device_hash = SHA-256 of the rcsm_device cookie set on that device at enrollment:
-- a passkey signs in only from the browser holding that cookie, so a synced passkey still needs a password sign-in
-- on each new device.
CREATE TABLE IF NOT EXISTS user_passkeys (
  id text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_hash text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_passkeys_user_idx ON user_passkeys (user_id);
CREATE INDEX IF NOT EXISTS user_passkeys_device_idx ON user_passkeys (device_hash);

-- One-time challenges (5 minutes). user_id is set for enrollment, NULL for sign-in.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge text PRIMARY KEY,
  user_id int REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at timestamptz NOT NULL
);

-- Fixed-window counters for the login rate limits (per IP and per email).
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count int NOT NULL
);

-- Audit trail: never passwords or tokens.
CREATE TABLE IF NOT EXISTS auth_audit (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  user_id int,
  email text,
  ip text,
  detail jsonb
);
CREATE INDEX IF NOT EXISTS auth_audit_created_idx ON auth_audit (created_at);

-- An academic semester (year + 1st/2nd semester, one per period) groups the batches studying in it and, per
-- teacher, the subjects they teach that semester. Deleting a batch, teacher or subject removes it from the
-- semesters; deleting a semester keeps the batches, teachers and subjects.
CREATE TABLE IF NOT EXISTS academic_semesters (
  id serial PRIMARY KEY,
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester int NOT NULL CHECK (semester IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, semester)
);
CREATE TABLE IF NOT EXISTS academic_semester_batches (
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  batch_id int NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  PRIMARY KEY (academic_semester_id, batch_id)
);
CREATE INDEX IF NOT EXISTS academic_semester_batches_batch_idx ON academic_semester_batches (batch_id);
-- A teacher is in the semester when they have at least one subject row in it.
CREATE TABLE IF NOT EXISTS academic_semester_teacher_subjects (
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  teacher_id int NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (academic_semester_id, teacher_id, subject_id)
);
CREATE INDEX IF NOT EXISTS academic_semester_ts_teacher_idx ON academic_semester_teacher_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS academic_semester_ts_subject_idx ON academic_semester_teacher_subjects (subject_id);

-- Gradings: per academic semester and subject, the batches whose students are graded, and one grade row per
-- student. Shared by every teacher who teaches that subject in that semester. A batch is only shown while it is
-- still in the semester; removing it from the subject keeps the grades (adding it back shows them again).
CREATE TABLE IF NOT EXISTS subject_batches (
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch_id int NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  PRIMARY KEY (academic_semester_id, subject_id, batch_id)
);
CREATE INDEX IF NOT EXISTS subject_batches_batch_idx ON subject_batches (batch_id);
-- Each type is 0–25 whole points; NULL = not given yet. Total = sum of the given ones (out of 100).
CREATE TABLE IF NOT EXISTS grades (
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id int NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance smallint CHECK (attendance BETWEEN 0 AND 25),
  assignments smallint CHECK (assignments BETWEEN 0 AND 25), -- assignments and activities
  participation smallint CHECK (participation BETWEEN 0 AND 25),
  exams smallint CHECK (exams BETWEEN 0 AND 25), -- midterm & final exam
  comment text CHECK (char_length(comment) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by int REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (academic_semester_id, subject_id, student_id)
);
CREATE INDEX IF NOT EXISTS grades_student_idx ON grades (student_id);

-- Teacher assignments: per academic semester + subject (shared by every teacher of that subject in that semester, like
-- grades), each with its own maximum points; a score per student (0..max_score, checked by the app), blank = no row.
-- Separate from grades.assignments (the 0–25 grade is still typed by hand).
CREATE TABLE IF NOT EXISTS assignments (
  id serial PRIMARY KEY,
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  due_on date NOT NULL,
  max_score smallint NOT NULL CHECK (max_score BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by int REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS assignments_semester_subject_idx ON assignments (academic_semester_id, subject_id, due_on);
CREATE TABLE IF NOT EXISTS assignment_scores (
  assignment_id int NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id int NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 1000),
  PRIMARY KEY (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS assignment_scores_student_idx ON assignment_scores (student_id);

-- Class work: each teacher's own weekly meetings in an academic semester, and per meeting + subject + student the
-- weekly marks: attendance (present | late | absent | excused) and assignments / participation scores 0–100.
-- NULL = not given; no row = nothing given yet.
CREATE TABLE IF NOT EXISTS class_meetings (
  id serial PRIMARY KEY,
  teacher_id int NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  held_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS class_meetings_teacher_semester_idx ON class_meetings (teacher_id, academic_semester_id, held_on);
CREATE TABLE IF NOT EXISTS class_meeting_marks (
  meeting_id int NOT NULL REFERENCES class_meetings(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id int NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance text CHECK (attendance IN ('present', 'late', 'absent', 'excused')),
  assignments smallint CHECK (assignments BETWEEN 0 AND 100),
  participation smallint CHECK (participation BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, subject_id, student_id)
);
CREATE INDEX IF NOT EXISTS class_meeting_marks_student_idx ON class_meeting_marks (student_id);

-- Assignments belong to a weekly meeting (migration 021; required by the app).
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS meeting_id int REFERENCES class_meetings(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS assignments_meeting_idx ON assignments (meeting_id);

-- The teacher's comment on a student's weekly participation (migration 022).
ALTER TABLE class_meeting_marks ADD COLUMN IF NOT EXISTS participation_comment text CHECK (char_length(participation_comment) <= 2000);
