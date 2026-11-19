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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS students_batch_idx ON students (batch_id);

-- Admins who manage the system (roles will come later). updated_at is set by the update action.
CREATE TABLE IF NOT EXISTS admins (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  date_of_birth date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
