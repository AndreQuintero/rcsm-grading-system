-- A teacher's comment per student on an assignment. A row may hold only a comment (score NULL = not scored), but never
-- neither. "Scored" everywhere means score IS NOT NULL.
ALTER TABLE assignment_scores ADD COLUMN IF NOT EXISTS comment text CHECK (char_length(comment) <= 2000);
ALTER TABLE assignment_scores ALTER COLUMN score DROP NOT NULL;
ALTER TABLE assignment_scores ADD CONSTRAINT assignment_scores_score_or_comment CHECK (score IS NOT NULL OR comment IS NOT NULL);
