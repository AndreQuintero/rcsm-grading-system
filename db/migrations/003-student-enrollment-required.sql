-- The enrollment date is required for every student, whatever the status.
-- Fails (and changes nothing) if a student without an enrollment date exists.

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_check;
ALTER TABLE students ALTER COLUMN enrollment_date SET NOT NULL;
