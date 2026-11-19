-- Admins and teachers get the same optional photo as students.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS photo bytea, ADD COLUMN IF NOT EXISTS photo_type text;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS photo bytea, ADD COLUMN IF NOT EXISTS photo_type text;
