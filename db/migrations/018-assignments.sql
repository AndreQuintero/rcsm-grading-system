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
