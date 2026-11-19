-- Batches group students by intake: the Nth batch of a year, in its 1st or 2nd semester.
-- A student belongs to at most one batch; deleting a batch keeps its students and frees them.

CREATE TABLE IF NOT EXISTS batches (
  id serial PRIMARY KEY,
  number int NOT NULL CHECK (number > 0),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester int NOT NULL CHECK (semester IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (number, year, semester)
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_id int REFERENCES batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS students_batch_idx ON students (batch_id);
