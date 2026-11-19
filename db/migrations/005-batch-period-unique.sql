-- Each year and semester has at most one batch, whatever its number.
-- Fails (and changes nothing) if two batches already share a year and semester.

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_number_year_semester_key;
ALTER TABLE batches ADD CONSTRAINT batches_year_semester_key UNIQUE (year, semester);
