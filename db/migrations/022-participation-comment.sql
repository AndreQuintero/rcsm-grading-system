-- Class work: the teacher's optional comment on a student's participation in a weekly meeting (per subject).
ALTER TABLE class_meeting_marks ADD COLUMN IF NOT EXISTS participation_comment text CHECK (char_length(participation_comment) <= 2000);
