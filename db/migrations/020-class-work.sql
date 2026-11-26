-- Class work: each teacher's own weekly meetings in an academic semester, and per meeting + subject + student the
-- weekly marks: attendance (present | late | absent | excused) and assignments / participation scores 0–100.
-- NULL = not given; no row = nothing given yet.
CREATE TABLE IF NOT EXISTS class_meetings (
  id serial PRIMARY KEY,
  teacher_id int NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  academic_semester_id int NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  held_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS class_meetings_teacher_semester_idx ON class_meetings (teacher_id, academic_semester_id, held_on);
CREATE TABLE IF NOT EXISTS class_meeting_marks (
  meeting_id int NOT NULL REFERENCES class_meetings(id) ON DELETE CASCADE,
  subject_id int NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id int NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance text CHECK (attendance IN ('present', 'late', 'absent', 'excused')),
  assignments smallint CHECK (assignments BETWEEN 0 AND 100),
  participation smallint CHECK (participation BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, subject_id, student_id)
);
CREATE INDEX IF NOT EXISTS class_meeting_marks_student_idx ON class_meeting_marks (student_id);
