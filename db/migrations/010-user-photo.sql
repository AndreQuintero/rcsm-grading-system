-- The account's own avatar: copied once from admins → teachers → students when the first password is set,
-- independent of those tables afterwards.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo bytea, ADD COLUMN IF NOT EXISTS photo_type text;
