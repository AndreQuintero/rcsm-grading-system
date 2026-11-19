-- Admins who manage the system (roles will come later). created_at is when the admin was registered,
-- updated_at the last time the record was changed (set by the update action).

CREATE TABLE IF NOT EXISTS admins (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  date_of_birth date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
