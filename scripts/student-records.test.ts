// Checks of the admin student records against the real database. Test rows: years 2085+, "Recordtest" students,
// @tchtest teachers, "TchTest" subjects; all removed at the end.
import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { listStudentRecords, studentSemesterRecord, studentSemesters } from "../lib/student-records";

const cleanup = async () => {
  await sql`DELETE FROM academic_semesters WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE first_name = 'Recordtest'`;
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM teachers WHERE email LIKE '%@tchtest.example.com'`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest %'`;
};
const ids = async (q: ReturnType<typeof sql>) => (await q).map((r) => r.id as number);

(async () => {
  await cleanup();
  try {
    const [b1, b2] = await ids(sql`INSERT INTO batches (number, year, semester) VALUES (1, 2085, 1), (2, 2086, 2) RETURNING id`);
    const [amy, ben, cid, dee] = await ids(sql`INSERT INTO students (first_name, last_name, email, date_of_birth, status, enrollment_date, batch_id) VALUES
      ('Recordtest', 'Amy', 'amy@stutest.example.com', '2000-01-01', 'full_time', '2085-08-01', ${b1}),
      ('Recordtest', 'Ben', 'ben@stutest.example.com', '2000-01-01', 'inactive', '2085-08-01', ${b1}),
      ('Recordtest', 'Cid', 'cid@stutest.example.com', '2000-01-01', 'audit', '2086-02-01', ${b2}),
      ('Recordtest', 'Dee', 'dee@stutest.example.com', '2000-01-01', 'audit', '2086-02-01', NULL) RETURNING id`);
    const [ada, bob] = await ids(sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES
      ('TchTest Ada', '1980-01-01', 'ada@tchtest.example.com'), ('TchTest Bob', '1980-01-01', 'bob@tchtest.example.com') RETURNING id`);
    const [worship, music, art] = await ids(sql`INSERT INTO subjects (name) VALUES ('TchTest Worship'), ('TchTest Music'), ('TchTest Art') RETURNING id`);
    const [s1] = await ids(sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 2) RETURNING id`);
    const [s2] = await ids(sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 1) RETURNING id`);
    const [s3] = await ids(sql`INSERT INTO academic_semesters (year, semester) VALUES (2091, 2) RETURNING id`);
    // s1: b1 with Worship (Ada + Bob) and Music (Ada, batch not added); s2: b1, nothing bound yet; s3: b2 only
    await sql`INSERT INTO academic_semester_batches VALUES (${s1}, ${b1}), (${s2}, ${b1}), (${s3}, ${b2})`;
    await sql`INSERT INTO academic_semester_teacher_subjects VALUES (${s1}, ${ada}, ${worship}), (${s1}, ${bob}, ${worship}), (${s1}, ${ada}, ${music}), (${s3}, ${bob}, ${art})`;
    await sql`INSERT INTO subject_batches VALUES (${s1}, ${worship}, ${b1})`;
    await sql`INSERT INTO grades (academic_semester_id, subject_id, student_id, midterm, participation, presence, final_exam, comment) VALUES
      (${s1}, ${worship}, ${amy}, 20, 20, 25, 22, 'Good'), (${s3}, ${art}, ${amy}, 10, NULL, NULL, NULL, NULL)`;

    // list: filters and inactive students
    const names = async (f = {}) => (await listStudentRecords(f)).students.filter((s) => s.name.startsWith("Recordtest")).map((s) => s.name.slice(11));
    assert.deepEqual(await names({ name: "recordtest" }), ["Amy", "Ben", "Cid", "Dee"]);
    assert.deepEqual(await names({ email: "ben@stutest" }), ["Ben"]);
    assert.deepEqual(await names({ status: "inactive", name: "recordtest" }), ["Ben"]);
    assert.deepEqual(await names({ batch: String(b2) }), ["Cid"]);
    assert.deepEqual(await names({ batch: "none", name: "recordtest" }), ["Dee"]);
    assert.equal((await listStudentRecords({ name: "recordtest amy" })).students[0].semesters, 3, "s1, s2 (batch) and s3 (graded)");

    // semesters: registered (batch) or graded, newest first in time order
    const amySem = await studentSemesters(amy);
    assert.deepEqual(amySem!.semesters.map((s) => s.id), [s3, s2, s1]);
    const one = amySem!.semesters.find((s) => s.id === s1)!;
    assert.deepEqual([one.subjects, one.graded, one.totalAvg, one.pct], [1, 1, 87, 87]);
    assert.deepEqual(amySem!.semesters.find((s) => s.id === s2), { id: s2, year: 2090, semester: 1, subjects: 0, graded: 0, totalAvg: null, pct: null });
    assert.deepEqual((await studentSemesters(dee))!.semesters, []);
    assert.equal(await studentSemesters(2147483000), null);

    // record: subjects that grade the student (Music's batch not added → not listed), with every teacher of the subject
    const rec = await studentSemesterRecord(amy, s1);
    assert.deepEqual(rec!.rows.map((r) => [r.subject, r.grades.final_exam, r.comment, r.teachers.map((t) => t.name)]),
      [["TchTest Worship", 22, "Good", ["TchTest Ada", "TchTest Bob"]]]);
    assert.equal((await studentSemesterRecord(ben, s1))!.rows.length, 1, "inactive students keep their record");
    assert.equal(await studentSemesterRecord(cid, s1), null, "not one of Cid's semesters");
    // history: Amy moves to b2; s3 (graded) stays, s1 stays only because she has grades there
    await sql`UPDATE students SET batch_id = ${b2} WHERE id = ${amy}`;
    assert.deepEqual((await studentSemesters(amy))!.semesters.map((s) => s.id), [s3, s1]);

    console.log("all student record checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("STUDENT RECORD CHECK FAILED:", e);
  process.exit(1);
});
