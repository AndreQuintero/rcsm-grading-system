-- New grading types: Attendance, Assignments and Activities, Participation (kept), Midterm & Final Exam; each 0–25.
-- Step 1 of 2, safe while the old code is live: add the new columns. The old grades are cleared by
-- 016b-clear-old-grades.sql, and 017 drops the old columns after the deploy.
ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS attendance smallint CHECK (attendance BETWEEN 0 AND 25),
  ADD COLUMN IF NOT EXISTS assignments smallint CHECK (assignments BETWEEN 0 AND 25),
  ADD COLUMN IF NOT EXISTS exams smallint CHECK (exams BETWEEN 0 AND 25);
