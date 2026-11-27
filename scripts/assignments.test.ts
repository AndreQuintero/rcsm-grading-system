// Checks of teacher assignments against the real database. Test rows: years 2085+, "Asgtest" students, "TchTest"
// subjects; all removed at the end (assignments cascade with their semester).
import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { parseAssignment, scoreAverage } from "../lib/assignment-shared";
import {
  assignmentCounts, assignmentMeetings, assignmentRanking, assignmentStudents, deleteAssignment, getAssignment, listAssignments, meetingAllowed,
  meetingLabel, saveAssignment, scoresAbove,
} from "../lib/assignment";
import { insertMeeting } from "../lib/class-work";

const cleanup = async () => {
  await sql`DELETE FROM academic_semesters WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE first_name = 'Asgtest'`;
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest %'`;
  await sql`DELETE FROM teachers WHERE email LIKE '%-asg@tchtest.example.com'`;
  await sql`DELETE FROM users WHERE email LIKE '%-asg@tchtest.example.com'`;
};
let meeting = "";
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const input = (o: Record<string, string>) => {
  const r = parseAssignment(fd({ meetingId: meeting, ...o }));
  assert.ok(r.data, JSON.stringify(r.errors));
  return r.data;
};

(async () => {
  await cleanup();
  try {
    // parsing: required fields, scores blank or 0..max
    const ok = parseAssignment(fd({ meetingId: "5", name: " Essay ", dueOn: "2090-08-10", maxScore: "20", "score-7": "18", "score-8": " ", "score-9": "0" }));
    assert.deepEqual([ok.data?.meetingId, ok.data?.name, ok.data?.dueOn, ok.data?.maxScore, [...ok.data!.scores]], [5, "Essay", "2090-08-10", 20, [[7, 18], [8, null], [9, 0]]]);
    const bad = parseAssignment(fd({ name: "", dueOn: "2090-02-31", maxScore: "0" })).errors!;
    assert.deepEqual(Object.keys(bad).sort(), ["dueOn", "maxScore", "meetingId", "name"], "a weekly meeting is required");
    assert.ok(parseAssignment(fd({ name: "X", dueOn: "2090-01-01", maxScore: "10", "score-1": "11" })).errors?.["score-1"], "above max");
    assert.ok(parseAssignment(fd({ name: "X", dueOn: "2090-01-01", maxScore: "10", "score-1": "2.5" })).errors?.["score-1"], "not whole");
    assert.ok(parseAssignment(fd({ name: "X", dueOn: "", maxScore: "10" })).errors?.dueOn);
    assert.ok(parseAssignment(fd({ name: "X".repeat(151), dueOn: "2090-01-01", maxScore: "10" })).errors?.name);
    assert.deepEqual(scoreAverage([10, null, 15, 6]), { avg: 10.3, n: 3 });
    assert.deepEqual(scoreAverage([null]), { avg: null, n: 0 });

    // setup: a semester with a bound batch (2 active students + 1 inactive) and a second subject with no batch
    const [b1] = await sql`INSERT INTO batches (number, year, semester) VALUES (1, 2085, 1) RETURNING id`;
    const [s1, s2] = await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, batch_id) VALUES
      ('Asgtest', 'Alpha', '2000-01-01', 'full_time', '2085-08-01', ${b1.id}), ('Asgtest', 'Beta', '2000-01-01', 'audit', '2085-08-01', ${b1.id}),
      ('Asgtest', 'Gone', '2000-01-01', 'inactive', '2085-08-01', ${b1.id}) RETURNING id`;
    const [worship, music] = await sql`INSERT INTO subjects (name) VALUES ('TchTest Worship'), ('TchTest Music') RETURNING id`;
    const [sem] = await sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 1) RETURNING id`;
    await sql`INSERT INTO academic_semester_batches VALUES (${sem.id}, ${b1.id})`;
    await sql`INSERT INTO subject_batches VALUES (${sem.id}, ${worship.id}, ${b1.id})`;
    // two teachers of Worship, each with their own weekly meeting
    const [ada, bob] = await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES
      ('Ada Asg', '1980-01-01', 'ada-asg@tchtest.example.com'), ('Bob Asg', '1980-01-01', 'bob-asg@tchtest.example.com') RETURNING id`;
    await sql`INSERT INTO academic_semester_teacher_subjects VALUES (${sem.id}, ${ada.id}, ${worship.id}), (${sem.id}, ${bob.id}, ${worship.id})`;
    const mAda = (await insertMeeting(ada.id, sem.id, { name: "Week #1", heldOn: "2090-08-03" }))!;
    const mBob = (await insertMeeting(bob.id, sem.id, { name: "Week #1 B", heldOn: "2090-08-04" }))!;
    meeting = String(mAda);

    // the students an assignment scores: the bound batch's, inactive left out
    const w = await assignmentStudents(sem.id, worship.id);
    assert.equal(w.batches, 1);
    assert.deepEqual(w.students.map((s) => s.name), ["Asgtest Alpha", "Asgtest Beta"]);
    assert.deepEqual(await assignmentStudents(sem.id, music.id), { batches: 0, students: [] });
    const listed = w.students.map((s) => s.id);

    // create: scores only for listed students, blanks skipped
    const a1 = await saveAssignment(sem.id, worship.id, null, null, input({ name: "Essay", dueOn: "2090-08-10", maxScore: "20", [`score-${s1.id}`]: "18", [`score-${s2.id}`]: "" }), listed);
    const a2 = await saveAssignment(sem.id, worship.id, null, null, input({ meetingId: String(mBob), name: "Quiz", dueOn: "2090-09-01", maxScore: "10" }), listed);
    assert.ok(a1 && a2);

    // weekly meetings: each assignment shows its meeting (and teacher); a filter keeps one meeting's assignments
    assert.deepEqual((await listAssignments({ semesterId: sem.id, subjectId: worship.id })).assignments.map((a) => [a.name, a.meeting?.name, a.meeting?.teacher]),
      [["Quiz", "Week #1 B", "Bob Asg"], ["Essay", "Week #1", "Ada Asg"]]);
    assert.deepEqual((await listAssignments({ semesterId: sem.id, subjectId: worship.id, meetingId: mAda })).assignments.map((a) => a.name), ["Essay"]);
    // Ada's options: her own meeting, plus Bob's because it holds a Worship assignment (for the filter)
    assert.deepEqual((await assignmentMeetings(ada.id, sem.id, worship.id)).map((m) => [m.name, m.own]), [["Week #1 B", false], ["Week #1", true]]);
    assert.deepEqual((await assignmentMeetings(ada.id, sem.id, music.id)).map((m) => m.name), ["Week #1"], "Bob's meeting holds no Music assignment");
    assert.equal(meetingLabel({ name: "Week #1 B", heldOn: "2090-08-04", teacher: "Bob Asg" }, false), "Week #1 B · August 4th, 2090 · Bob Asg");
    // only your own meeting of the semester, or the one the assignment already has
    assert.equal(await meetingAllowed(ada.id, sem.id, mAda), true);
    assert.equal(await meetingAllowed(ada.id, sem.id, mBob), false);
    assert.equal(await meetingAllowed(ada.id, sem.id, mBob, mBob), true, "keeping another teacher's meeting on edit");
    assert.equal(await meetingAllowed(ada.id, sem.id + 1_000_000, mAda), false, "wrong semester");
    assert.equal((await getAssignment(sem.id, worship.id, a2!))?.meetingTeacherId, bob.id);

    // comments: optional per student, ≤ 2000; a comment alone is kept but doesn't count as scored
    assert.ok(parseAssignment(fd({ meetingId: meeting, name: "X", dueOn: "2090-01-01", maxScore: "10", "comment-1": "x".repeat(2001) })).errors?.["comment-1"]);
    const a3 = (await saveAssignment(sem.id, worship.id, null, null, input({ name: "Reflection", dueOn: "2090-07-01", maxScore: "10",
      [`score-${s1.id}`]: "6", [`comment-${s1.id}`]: " Good start ", [`score-${s2.id}`]: "", [`comment-${s2.id}`]: "Didn't hand it in" }), listed))!;
    let r3 = await getAssignment(sem.id, worship.id, a3);
    assert.deepEqual([r3!.scores, r3!.comments], [{ [s1.id]: 6 }, { [s1.id]: "Good start", [s2.id]: "Didn't hand it in" }]);
    assert.equal((await listAssignments({ semesterId: sem.id, subjectId: worship.id, name: "Reflection" })).assignments[0].graded, 1, "a comment alone isn't scored");
    const rk = (await assignmentRanking(sem.id, worship.id)).students.find((x) => x.id === s2.id)!;
    assert.equal(rk.scored, (await sql`SELECT count(*)::int AS n FROM assignment_scores sc JOIN assignments a ON a.id = sc.assignment_id
      WHERE a.subject_id = ${worship.id} AND sc.student_id = ${s2.id} AND sc.score IS NOT NULL`)[0].n, "ranking counts real scores only");
    // clearing both removes the row; the other student's score + comment change together
    await saveAssignment(sem.id, worship.id, a3, null, input({ name: "Reflection", dueOn: "2090-07-01", maxScore: "10",
      [`score-${s1.id}`]: "7", [`comment-${s1.id}`]: "", [`score-${s2.id}`]: "", [`comment-${s2.id}`]: "" }), listed);
    r3 = await getAssignment(sem.id, worship.id, a3);
    assert.deepEqual([r3!.scores, r3!.comments], [{ [s1.id]: 7 }, {}]);
    assert.equal((await sql`SELECT count(*)::int AS n FROM assignment_scores WHERE assignment_id = ${a3}`)[0].n, 1);
    await deleteAssignment(sem.id, worship.id, a3);
    let list = await listAssignments({ semesterId: sem.id, subjectId: worship.id });
    assert.deepEqual(list.assignments.map((a) => [a.name, a.dueOn, a.graded, a.avg]), [["Quiz", "2090-09-01", 0, null], ["Essay", "2090-08-10", 1, 18]], "newest date first");
    assert.equal(list.total, 2);
    assert.deepEqual((await listAssignments({ semesterId: sem.id, subjectId: worship.id, name: "ess" })).assignments.map((a) => a.name), ["Essay"]);
    assert.deepEqual((await listAssignments({ semesterId: sem.id, subjectId: worship.id, date: "2090-09-01" })).assignments.map((a) => a.name), ["Quiz"]);
    assert.equal((await assignmentCounts(sem.id)).get(worship.id), 2);

    // edit: a new score is added, a blank removes one, an unlisted student's score is kept
    await sql`INSERT INTO assignment_scores VALUES (${a1}, ${(await sql`SELECT id FROM students WHERE last_name = 'Gone' AND first_name = 'Asgtest'`)[0].id}, 15)`;
    assert.equal(await saveAssignment(sem.id, worship.id, a1, null, input({ name: "Essay 1", dueOn: "2090-08-11", maxScore: "20", [`score-${s1.id}`]: "", [`score-${s2.id}`]: "12" }), listed), a1);
    const got = await getAssignment(sem.id, worship.id, a1!);
    assert.deepEqual([got?.name, got?.dueOn, Object.keys(got!.scores).length, got?.scores[String(s2.id)]], ["Essay 1", "2090-08-11", 2, 12]);
    list = await listAssignments({ semesterId: sem.id, subjectId: worship.id, name: "Essay" });
    assert.deepEqual([list.assignments[0].graded, list.assignments[0].avg], [2, 13.5]);
    assert.equal(await scoresAbove(a1!, 14, listed), 1, "the unlisted student's 15 is above 14");
    assert.equal(await scoresAbove(a1!, 15, listed), 0);

    // ranking: points earned ÷ possible over scored assignments only; unscored students last, unranked
    let rank = await assignmentRanking(sem.id, worship.id);
    assert.equal(rank.assignments, 2);
    assert.deepEqual(rank.students.map((r) => [r.name, r.place, r.pct, r.earned, r.possible, r.scored]),
      [["Asgtest Beta", 1, 60, 12, 20, 1], ["Asgtest Alpha", null, null, 0, 0, 0]], "the unscored quiz and the inactive student don't count");
    await saveAssignment(sem.id, worship.id, a2, null, input({ name: "Quiz", dueOn: "2090-09-01", maxScore: "10", [`score-${s1.id}`]: "8", [`score-${s2.id}`]: "10" }), listed);
    rank = await assignmentRanking(sem.id, worship.id);
    assert.deepEqual(rank.students.map((r) => [r.name, r.place, r.pct]), [["Asgtest Alpha", 1, 80], ["Asgtest Beta", 2, 73.3]], "22/30 = 73.3%");
    await saveAssignment(sem.id, worship.id, a1, null, input({ name: "Essay 1", dueOn: "2090-08-11", maxScore: "20", [`score-${s1.id}`]: "14", [`score-${s2.id}`]: "12" }), listed);
    rank = await assignmentRanking(sem.id, worship.id);
    assert.deepEqual(rank.students.map((r) => [r.name, r.place, r.pct]), [["Asgtest Alpha", 1, 73.3], ["Asgtest Beta", 1, 73.3]], "ties share a place");
    assert.deepEqual(await assignmentRanking(sem.id, music.id), { assignments: 0, students: [] });

    // another subject's or semester's id can't be read, edited or deleted through this one
    assert.equal(await getAssignment(sem.id, music.id, a1!), null);
    assert.equal(await saveAssignment(sem.id, music.id, a1, null, input({ name: "Hijack", dueOn: "2090-08-11", maxScore: "20" }), listed), null);
    await deleteAssignment(sem.id, music.id, a1!);
    assert.ok(await getAssignment(sem.id, worship.id, a1!), "wrong subject: not deleted");
    await deleteAssignment(sem.id, worship.id, a1!);
    assert.equal(await getAssignment(sem.id, worship.id, a1!), null);
    assert.equal((await sql`SELECT count(*)::int AS n FROM assignment_scores WHERE assignment_id = ${a1}`)[0].n, 0, "scores cascade");
    // deleting a weekly meeting deletes its assignments
    await sql`DELETE FROM class_meetings WHERE id = (SELECT meeting_id FROM assignments WHERE id = ${a2})`;
    assert.equal(await getAssignment(sem.id, worship.id, a2!), null);

    console.log("all assignment checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("ASSIGNMENT CHECK FAILED:", e);
  process.exit(1);
});
