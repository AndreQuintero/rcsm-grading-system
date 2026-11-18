CREATE TABLE IF NOT EXISTS teachers (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  email text NOT NULL UNIQUE,
  subjects text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
