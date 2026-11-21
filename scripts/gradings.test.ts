// Checks of teacher gradings against the real database. Test rows: years 2085+, @tchtest teachers,
// "Gradetest" students, "TchTest" subjects; all removed at the end.
import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { gradeAverages, gradeTotal, homeSummary, overallScore, parseGrades, subjectAverages, type Grades } from "../lib/grading-shared";
import {
  bindBatch, saveGrades, studentGrading, studentRecord, subjectGrading, teacherCanSeeStudent, teacherSemesters,
  teacherStudentFilters, teacherStudents, teacherSubjects, teaches, unbindBatch,
} from "../lib/grading";

const cleanup = async () => {
  await sql`DELETE FROM academic_semesters WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE first_name = 'Gradetest'`;
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM teachers WHERE email LIKE '%@tchtest.example.com'`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest %'`;
};
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const NONE = { attendance: null, participation: null, assignments: null, exams: null, comment: null };

(async () => {
  await cleanup();
  try {
    // parsing and the total
    assert.deepEqual(parseGrades(fd({ attendance: "20", participation: " ", assignments: "25", exams: "0", comment: " Good " })).data,
      { attendance: 20, participation: null, assignments: 25, exams: 0, comment: "Good" });
    for (const bad of ["26", "-1", "12.5", "abc"]) assert.ok(parseGrades(fd({ attendance: bad })).errors?.attendance, bad);
    assert.ok(parseGrades(fd({ comment: "x".repeat(2001) })).errors?.comment);
    assert.deepEqual(gradeTotal({ attendance: 20, participation: null, assignments: 25, exams: 0 }), { total: 45, given: 3 });
    const av = gradeAverages([
      { attendance: 20, participation: null, assignments: 25, exams: null },
      { attendance: 15, participation: 10, assignments: null, exams: null },
      { attendance: null, participation: null, assignments: null, exams: null },
    ]);
    assert.deepEqual(av.attendance, { avg: 17.5, n: 2 });
    assert.deepEqual(av.participation, { avg: 10, n: 1 });
    assert.deepEqual(av.exams, { avg: null, n: 0 });
    assert.deepEqual(av.total, { avg: 35, n: 2 }, "ungraded students don't pull the total down");
    const g4 = (m: number | null, p: number | null) => ({ attendance: m, participation: p, assignments: null, exams: null });
    assert.deepEqual(subjectAverages([
      { subject: "Worship", grades: g4(20, 20) }, { subject: "Worship", grades: g4(10, 10) },
      { subject: "Music", grades: g4(25, null) }, { subject: "Art", grades: g4(null, null) },
    ]), [{ subject: "Worship", avg: 30, semesters: 2 }, { subject: "Music", avg: 25, semesters: 1 }], "ungraded rows skipped");
    assert.deepEqual(overallScore([{ grades: g4(20, 20) }, { grades: g4(25, null) }]), { earned: 65, possible: 75, pct: 87 });
    assert.deepEqual(overallScore([{ grades: g4(null, null) }]), { earned: 0, possible: 0, pct: null });
    const st = (id: number, grades: Grades) => ({ id, name: `S${id}`, hasPhoto: false, grades });
    const full = { attendance: 20, participation: 20, assignments: 20, exams: 20 };
    const home = homeSummary([
      { subjectId: 1, subject: "Worship", students: [st(1, full), st(2, g4(5, null)), st(3, g4(null, null))] },
      { subjectId: 2, subject: "Music", students: [st(4, full)] },
    ]);
    const capped = homeSummary([{ subjectId: 3, subject: "Art", students: [
      st(10, g4(10, 10)), st(11, g4(11, 11)), st(12, g4(12, 12)), st(13, g4(13, 13)), st(14, g4(14, 14)),
      st(15, g4(23, 22)), st(16, g4(24, 23)),
    ] }]);
    assert.deepEqual(capped.lowest.map((x) => x.id), [10, 11, 12, 13], "at most 4");
    const cut = homeSummary([{ subjectId: 3, subject: "Art", students: [st(15, g4(23, 22)), st(16, g4(24, 23))] }]);
    assert.deepEqual(cut.lowest.map((x) => [x.id, x.pct]), [[15, 90]], "90% kept, 94% dropped");
    assert.deepEqual(home.missing, [{ subjectId: 1, subject: "Worship", students: 2, byType: { attendance: 1, participation: 2, assignments: 2, exams: 2 } }]);
    assert.deepEqual(home.averages, [{ subject: "Worship", avg: 42.5, semesters: 2 }, { subject: "Music", avg: 80, semesters: 1 }]);
    assert.deepEqual(home.lowest.map((x) => [x.id, x.pct, x.total, x.possible]), [[2, 20, 5, 25], [1, 80, 80, 100], [4, 80, 80, 100]], "% of points given, ungraded skipped");

    // setup: a semester with two batches, one batch outside it, two teachers sharing a subject
    const [b1, b2, bOut] = await sql`INSERT INTO batches (number, year, semester) VALUES (1, 2085, 1), (2, 2086, 2), (3, 2087, 1) RETURNING id`;
    const [s1, s2, sInactive, sOther, sOut] = await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, batch_id) VALUES
      ('Gradetest', 'Alpha', '2000-01-01', 'full_time', '2085-08-01', ${b1.id}), ('Gradetest', 'Beta', '2000-01-01', 'audit', '2085-08-01', ${b1.id}),
      ('Gradetest', 'Gone', '2000-01-01', 'inactive', '2085-08-01', ${b1.id}), ('Gradetest', 'Other', '2000-01-01', 'audit', '2086-02-01', ${b2.id}),
      ('Gradetest', 'Outside', '2000-01-01', 'audit', '2087-08-01', ${bOut.id}) RETURNING id`;
    const [t1, t2, t3] = await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES
      ('TchTest One', '1980-01-01', 'one@tchtest.example.com'), ('TchTest Two', '1980-01-01', 'two@tchtest.example.com'),
      ('TchTest Three', '1980-01-01', 'three@tchtest.example.com') RETURNING id`;
    const [worship, music] = await sql`INSERT INTO subjects (name) VALUES ('TchTest Worship'), ('TchTest Music') RETURNING id`;
    const [old] = await sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 2) RETURNING id`;
    const [sem] = await sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 1) RETURNING id`;
    await sql`INSERT INTO academic_semester_batches VALUES (${sem.id}, ${b1.id}), (${sem.id}, ${b2.id})`;
    await sql`INSERT INTO academic_semester_teacher_subjects VALUES
      (${sem.id}, ${t1.id}, ${worship.id}), (${sem.id}, ${t2.id}, ${worship.id}), (${sem.id}, ${t1.id}, ${music.id}), (${old.id}, ${t1.id}, ${music.id})`;

    // which semesters and subjects a teacher sees
    assert.deepEqual((await teacherSemesters(t1.id)).map((s) => s.id), [sem.id, old.id], "newest in time first");
    assert.deepEqual(await teacherSemesters(t3.id), []);
    assert.equal(await teaches(sem.id, worship.id, t2.id), true);
    assert.equal(await teaches(sem.id, music.id, t2.id), false);
    assert.deepEqual((await teacherSubjects(sem.id, t1.id)).map((s) => s.name), ["TchTest Music", "TchTest Worship"]);

    // binding: only the semester's batches; inactive and unbound students are not listed
    assert.equal(await bindBatch(sem.id, worship.id, bOut.id), false, "a batch outside the semester can't be bound");
    assert.equal(await bindBatch(sem.id, worship.id, b1.id), true);
    const page = await subjectGrading(sem.id, worship.id);
    assert.deepEqual(page!.batches.map((b) => b.bound), [true, false]);
    assert.deepEqual(page!.students.map((s) => s.name), ["Gradetest Alpha", "Gradetest Beta"]);

    // saving: allowed for a listed student only, shared by both teachers of the subject
    const [anyUser] = await sql`SELECT id FROM users LIMIT 1`;
    const by = (anyUser?.id as number) ?? null;
    assert.equal(await saveGrades(sem.id, worship.id, s1.id, by, { ...NONE, attendance: 20, assignments: 25, comment: "Focused" }), true);
    assert.equal(await saveGrades(sem.id, worship.id, sInactive.id, by, NONE), false, "inactive student");
    assert.equal(await saveGrades(sem.id, worship.id, sOther.id, by, NONE), false, "batch not bound");
    assert.equal(await saveGrades(sem.id, worship.id, sOut.id, by, NONE), false, "batch outside the semester");
    const g = await studentGrading(sem.id, worship.id, s1.id);
    assert.deepEqual(g!.grades, { attendance: 20, participation: null, assignments: 25, exams: null });
    assert.equal(g!.comment, "Focused");
    assert.equal(await studentGrading(sem.id, worship.id, sInactive.id), null);
    assert.equal(await studentGrading(sem.id, music.id, s1.id), null, "grades are per subject");
    // the other teacher edits the same row
    await saveGrades(sem.id, worship.id, s1.id, by, { attendance: 22, participation: 25, assignments: 25, exams: 25, comment: null });
    assert.equal(gradeTotal((await studentGrading(sem.id, worship.id, s1.id))!.grades).total, 97);
    assert.deepEqual((await teacherSubjects(sem.id, t2.id)).map((s) => [s.batches, s.students, s.complete]), [[1, 2, 1]]);

    // unbinding hides the students but keeps the grades; binding again shows them
    await unbindBatch(sem.id, worship.id, b1.id);
    assert.equal((await subjectGrading(sem.id, worship.id))!.students.length, 0);
    await bindBatch(sem.id, worship.id, b1.id);
    assert.equal((await studentGrading(sem.id, worship.id, s1.id))!.grades.attendance, 22);

    // score records: the teacher's students across semesters (batch students incl. inactive, plus graded ones)
    const names = async (t: number, f = {}) => (await teacherStudents(t, f)).students.map((x) => x.name.replace("Gradetest ", "")).sort();
    assert.deepEqual(await names(t1.id), ["Alpha", "Beta", "Gone"]);
    assert.deepEqual(await names(t3.id), []);
    assert.deepEqual(await names(t1.id, { name: "bet" }), ["Beta"]);
    assert.deepEqual(await names(t1.id, { batchId: b2.id }), []);
    assert.deepEqual(await names(t1.id, { semesterId: old.id }), []);
    assert.deepEqual(await names(t1.id, { semesterId: sem.id }), ["Alpha", "Beta", "Gone"]);
    assert.equal((await teacherStudents(t1.id)).students.find((x) => x.id === s1.id)!.graded, 1);
    assert.deepEqual((await teacherStudentFilters(t1.id)).batches.map((b) => b.id), [b1.id]);
    await unbindBatch(sem.id, worship.id, b1.id);
    assert.deepEqual(await names(t1.id), ["Alpha"], "graded students stay after their batch is removed");
    assert.equal(await teacherCanSeeStudent(t1.id, s1.id), true);
    assert.equal(await teacherCanSeeStudent(t1.id, s2.id), false);
    await bindBatch(sem.id, worship.id, b1.id);
    const rec = await studentRecord(t1.id, s1.id);
    assert.deepEqual(rec!.rows.map((r) => [r.subject, gradeTotal(r.grades).total]), [["TchTest Worship", 97]]);
    assert.equal(await studentRecord(t3.id, s1.id), null, "not this teacher's student");
    assert.equal(await studentRecord(t2.id, sOther.id), null);
    assert.equal((await studentRecord(t2.id, s2.id))!.rows.length, 1, "assigned but not graded yet");

    console.log("all grading checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("GRADING CHECK FAILED:", e);
  process.exit(1);
});
