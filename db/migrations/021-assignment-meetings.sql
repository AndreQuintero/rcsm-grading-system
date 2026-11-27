-- Assignments belong to a weekly meeting (class_meetings); deleting the meeting deletes its assignments and scores.
-- The 4 assignments made before this had no meeting and are deleted on the user's request (their scores cascade).
-- meeting_id stays nullable in the database so the code deployed before this change keeps working; the app requires
-- it on every create and edit.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS meeting_id int REFERENCES class_meetings(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS assignments_meeting_idx ON assignments (meeting_id);
DELETE FROM assignments WHERE meeting_id IS NULL;
