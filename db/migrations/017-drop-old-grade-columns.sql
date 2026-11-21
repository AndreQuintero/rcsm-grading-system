-- Step 2 of 2, applied once production serves the code that uses the new grading types: drop rows the old code
-- saved in between (only old columns set), then the old columns.
DELETE FROM grades
WHERE num_nonnulls(attendance, assignments, exams) = 0
  AND num_nonnulls(midterm, presence, final_exam) > 0;
ALTER TABLE grades DROP COLUMN midterm, DROP COLUMN presence, DROP COLUMN final_exam;
