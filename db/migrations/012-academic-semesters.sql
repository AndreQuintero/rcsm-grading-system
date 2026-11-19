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
