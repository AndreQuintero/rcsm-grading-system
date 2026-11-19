-- Password links now have a purpose: 'setup' (first sign-in, only for an account with no password yet) or
-- 'reset' (forgotten password, may replace the existing password). Existing rows are first-sign-in links.
ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'setup' CHECK (purpose IN ('setup', 'reset'));
