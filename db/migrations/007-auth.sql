-- Invite-only login. People exist only in admins/teachers/students; users + user_roles mirror them
-- (kept in step by syncUserFromRoleTables in lib/auth/sync.ts). No passwords or tokens are stored in clear.

ALTER TABLE students ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON students (lower(email)) WHERE email IS NOT NULL;

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
