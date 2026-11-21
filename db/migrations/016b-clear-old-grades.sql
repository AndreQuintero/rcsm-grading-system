-- The school starts fresh with the new grading types: remove the grades saved under the old ones (grades, comments,
-- "last saved by") and rows with no grade at all. Safe before or after the deploy: the new code never writes the old
-- columns, so a grade entered under the new types is never matched. Bound batches (subject_batches) are kept.
DELETE FROM grades
WHERE num_nonnulls(midterm, presence, final_exam) > 0
  OR num_nonnulls(attendance, assignments, participation, exams) = 0;
