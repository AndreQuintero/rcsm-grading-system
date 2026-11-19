-- Set by an admin on the Users page to block sign-in. Separate from is_active, which the role-table sync owns
-- (it would re-activate the account on the next edit of the person's admin/teacher/student record).
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
