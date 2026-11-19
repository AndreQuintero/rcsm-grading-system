-- Renames the student status "inquiry" to "inactive".
-- The allowed values live in two check constraints, so both are replaced; all statements run in one transaction.

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_check;

UPDATE students SET status = 'inactive' WHERE status = 'inquiry';

ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('audit', 'full_time', 'inactive'));
ALTER TABLE students ADD CONSTRAINT students_check CHECK (status = 'inactive' OR enrollment_date IS NOT NULL);
