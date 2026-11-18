CREATE TABLE IF NOT EXISTS teachers (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  email text NOT NULL UNIQUE,
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
