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
  midterm smallint CHECK (midterm BETWEEN 0 AND 25),
  participation smallint CHECK (participation BETWEEN 0 AND 25),
  presence smallint CHECK (presence BETWEEN 0 AND 25),
  final_exam smallint CHECK (final_exam BETWEEN 0 AND 25),
  comment text CHECK (char_length(comment) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by int REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (academic_semester_id, subject_id, student_id)
);
CREATE INDEX IF NOT EXISTS grades_student_idx ON grades (student_id);
