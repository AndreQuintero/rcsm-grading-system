-- Teachers no longer have fixed subjects: what they teach is set per academic semester (migration 012).
-- Apply only after the code that stops reading teacher_subjects is deployed.
DROP TABLE IF EXISTS teacher_subjects;
