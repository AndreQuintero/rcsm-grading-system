-- One-off migration for databases created before teacher_subjects existed.
-- Moves the free-text teachers.subjects column into real subjects, links them,
-- then drops the old column. Run once; all statements run in one transaction.

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id int NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE INDEX IF NOT EXISTS teacher_subjects_subject_idx ON teacher_subjects (subject_id);

INSERT INTO subjects (name)
SELECT DISTINCT trim(n) FROM teachers, unnest(subjects) AS n
WHERE trim(n) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT t.id, s.id
FROM teachers t, unnest(t.subjects) AS n
JOIN subjects s ON s.name = trim(n)
ON CONFLICT DO NOTHING;

ALTER TABLE teachers DROP COLUMN subjects;
