-- The school starts fresh with the new grading types: remove the grades saved under the old ones (grades, comments,
-- "last saved by"). Bound batches (subject_batches) are kept.
DELETE FROM grades;
