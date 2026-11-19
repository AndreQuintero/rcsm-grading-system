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

-- A teacher teaches many subjects; deleting either side removes the link.
CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id int NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE INDEX IF NOT EXISTS teacher_subjects_subject_idx ON teacher_subjects (subject_id);

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
  is_active boolean NOT NULL DEFAULT true,
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
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

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
