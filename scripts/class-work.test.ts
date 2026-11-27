// Checks of class work (weekly meetings and their marks) against the real database. Test rows: years 2085–2100,
// @tchtest teachers, "TchTest" subjects, "Cwtest" students; all removed at the end, real rows untouched.
import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { createAcademicSemester } from "../lib/academic-semester";
import { deleteMeeting, getMeeting, insertMeeting, listMeetings, meetingAssignmentCount, meetingStudents, saveAttendance, saveParticipation, updateMeeting } from "../lib/class-work";
import { meetingSummary, parseAttendance, parseMeeting, parseParticipation } from "../lib/class-work-shared";
import { bindBatch } from "../lib/grading";

const cleanup = async () => {
  await sql`DELETE FROM academic_semesters WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE first_name = 'Cwtest'`;
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM teachers WHERE email LIKE '%-cw@tchtest.example.com'`;
  await sql`DELETE FROM users WHERE email LIKE '%-cw@tchtest.example.com'`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest CW %'`;
};
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

(async () => {
  await cleanup();
  try {
    // parsing
    assert.deepEqual(parseMeeting(fd({ name: " Week #1 ", heldOn: "2090-08-03" })).data, { name: "Week #1", heldOn: "2090-08-03" });
    assert.ok(parseMeeting(fd({ name: "", heldOn: "2090-08-03" })).errors?.name);
    assert.ok(parseMeeting(fd({ name: "x".repeat(151), heldOn: "2090-08-03" })).errors?.name);
    assert.ok(parseMeeting(fd({ name: "Week", heldOn: "2090-02-30" })).errors?.heldOn);

    // summary maths: excused left out of the %, averages over marked students only
    const s = meetingSummary([
      { attendance: "present", assignments: 80, participation: null },
      { attendance: "late", assignments: 90, participation: 70 },
      { attendance: "absent", assignments: null, participation: null },
      { attendance: "excused", assignments: null, participation: 50 },
      { attendance: null, assignments: null, participation: null },
    ]);
    assert.deepEqual(s.attendance, { counts: { present: 1, late: 1, absent: 1, excused: 1 }, pct: 67, n: 4 });
    assert.deepEqual(s.assignments, { avg: 85, n: 2 });
    assert.deepEqual(s.participation, { avg: 60, n: 2 });
    assert.equal(meetingSummary([]).attendance.pct, null);

    const [ada, bob] = (await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES
      ('Ada Cw', '1980-01-01', 'ada-cw@tchtest.example.com'), ('Bob Cw', '1980-01-01', 'bob-cw@tchtest.example.com') RETURNING id`).map((r) => r.id as number);
    const [art, music] = (await sql`INSERT INTO subjects (name) VALUES ('TchTest CW Art'), ('TchTest CW Music') RETURNING id`).map((r) => r.id as number);
    const [b1] = (await sql`INSERT INTO batches (number, year, semester) VALUES (81, 2090, 1) RETURNING id`).map((r) => r.id as number);
    const [st1, st2] = (await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, batch_id) VALUES
      ('Cwtest', 'Alpha', '2000-01-01', 'full_time', '2090-07-01', ${b1}), ('Cwtest', 'Beta', '2000-01-01', 'audit', '2090-07-01', ${b1}) RETURNING id`).map((r) => r.id as number);
    const sem = await createAcademicSemester({ year: 2090, semester: 1, batchIds: [b1], teachers: [{ teacherId: ada, subjectIds: [art, music] }] });
    const other = await createAcademicSemester({ year: 2091, semester: 1, batchIds: [], teachers: [] });

    // create: only in a semester the teacher teaches in
    assert.equal(await insertMeeting(bob, sem, { name: "Week #1", heldOn: "2090-08-03" }), null, "Bob doesn't teach in it");
    assert.equal(await insertMeeting(ada, other, { name: "Week #1", heldOn: "2091-08-03" }), null);
    const w1 = (await insertMeeting(ada, sem, { name: "Week #1", heldOn: "2090-08-03" }))!;
    const w2 = (await insertMeeting(ada, sem, { name: "Week #2", heldOn: "2090-08-10" }))!;
    for (let i = 3; i <= 12; i++) await insertMeeting(ada, sem, { name: `Week #${i}`, heldOn: `2090-09-${String(i).padStart(2, "0")}` });

    // list: newest first, 10 per page, own only
    const p1 = await listMeetings(ada, sem);
    assert.equal(p1.total, 12);
    assert.equal(p1.meetings.length, 10);
    assert.equal(p1.meetings[0].name, "Week #12");
    assert.deepEqual((await listMeetings(ada, sem, 2)).meetings.map((m) => m.name), ["Week #2", "Week #1"]);
    assert.equal((await listMeetings(bob, sem)).total, 0);

    // ownership: another teacher can't read, edit or delete
    assert.equal(await getMeeting(bob, w1), null);
    assert.equal(await updateMeeting(bob, w1, { name: "Hacked", heldOn: "2090-08-03" }), false);
    assert.equal(await deleteMeeting(bob, w1), false);
    assert.equal(await updateMeeting(ada, w1, { name: "Week #1 (opening)", heldOn: "2090-08-04" }), true);
    assert.deepEqual(await getMeeting(ada, w1), { id: w1, name: "Week #1 (opening)", heldOn: "2090-08-04", semesterId: sem, period: { year: 2090, semester: 1 } });

    // students: the subject's graded students (batch bound) with their marks for this meeting only
    assert.deepEqual(await meetingStudents(w1, sem, art), [], "no batch bound yet");
    await bindBatch(sem, art, b1);
    await sql`INSERT INTO class_meeting_marks (meeting_id, subject_id, student_id, attendance, assignments, participation) VALUES
      (${w1}, ${art}, ${st1}, 'present', 90, 80), (${w2}, ${art}, ${st1}, 'absent', null, null), (${w1}, ${music}, ${st2}, 'late', 10, 10)`;
    // assignments = % earned in this meeting's assignments of the subject: 18 + 9 of 20 + 10 → 90%
    const [x1, x2] = (await sql`INSERT INTO assignments (academic_semester_id, subject_id, name, due_on, max_score, meeting_id) VALUES
      (${sem}, ${art}, 'Essay', '2090-08-04', 20, ${w1}), (${sem}, ${art}, 'Quiz', '2090-08-04', 10, ${w1}) RETURNING id`).map((r) => r.id as number);
    await sql`INSERT INTO assignment_scores VALUES (${x1}, ${st1}, 18), (${x2}, ${st1}, 9)`;
    assert.equal(await meetingAssignmentCount(w1, art), 2);
    assert.equal(await meetingAssignmentCount(w2, art), 0);
    const list = await meetingStudents(w1, sem, art);
    assert.deepEqual(list.map((x) => [x.name, x.marks]), [
      ["Cwtest Alpha", { attendance: "present", assignments: 90, participation: 80, participationComment: null }],
      ["Cwtest Beta", { attendance: null, assignments: null, participation: null, participationComment: null }],
    ]);
    assert.equal(list[0].batch, "81st batch, 2090 – 1st semester");
    assert.deepEqual((await meetingStudents(w1, sem, art, st2)).map((x) => x.id), [st2]);
    assert.deepEqual(await meetingStudents(w1, sem, music), [], "music has no batch, so no students");

    // attendance form: only the four statuses or blank
    assert.deepEqual([...parseAttendance(fd({ [`att-${st1}`]: "late", [`att-${st2}`]: "" })).data!], [[st1, "late"], [st2, null]]);
    assert.ok(parseAttendance(fd({ [`att-${st1}`]: "sick" })).error);
    // saving: upserts the listed students, a blank clears, the other marks of the row are kept, unlisted untouched
    await saveAttendance(w1, art, [st1, st2], new Map([[st1, "absent"], [st2, "excused"]]));
    let marks = await meetingStudents(w1, sem, art);
    assert.deepEqual(marks.map((x) => x.marks.attendance), ["absent", "excused"]);
    assert.equal(marks[0].marks.participation, 80, "participation kept");
    await saveAttendance(w1, art, [st1], new Map([[st1, null], [st2, "present"]]));
    marks = await meetingStudents(w1, sem, art);
    assert.deepEqual(marks.map((x) => x.marks.attendance), [null, "excused"], "blank clears; a student not allowed is untouched");
    assert.equal((await sql`SELECT attendance FROM class_meeting_marks WHERE meeting_id = ${w1} AND subject_id = ${music} AND student_id = ${st2}`)[0].attendance, "late", "other subject untouched");

    // participation form: score blank or whole 0–100, comment ≤ 2000
    assert.deepEqual([...parseParticipation(fd({ [`part-${st1}`]: " 85 ", [`note-${st1}`]: " Great questions ", [`part-${st2}`]: "", [`note-${st2}`]: "" })).data!],
      [[st1, { score: 85, comment: "Great questions" }], [st2, { score: null, comment: null }]]);
    const pe = parseParticipation(fd({ [`part-${st1}`]: "101", [`part-${st2}`]: "7.5", [`note-${st1}`]: "x".repeat(2001) })).errors!;
    assert.deepEqual(Object.keys(pe).sort(), [`note-${st1}`, `part-${st1}`, `part-${st2}`].sort());
    // saving: scores + comments for the listed students, attendance on the row kept, a missing row clears both
    await saveParticipation(w1, art, [st1, st2], new Map([[st1, { score: 85, comment: "Great questions" }], [st2, { score: 40, comment: null }]]));
    marks = await meetingStudents(w1, sem, art);
    assert.deepEqual(marks.map((x) => [x.marks.participation, x.marks.participationComment, x.marks.attendance]),
      [[85, "Great questions", null], [40, null, "excused"]]);
    await saveParticipation(w1, art, [st2], new Map());
    marks = await meetingStudents(w1, sem, art);
    assert.deepEqual(marks.map((x) => x.marks.participation), [85, null], "cleared for the listed student only");
    assert.equal(marks[1].marks.attendance, "excused");

    // deleting a meeting removes its marks and assignments only
    assert.equal(await deleteMeeting(ada, w1), true);
    assert.equal((await sql`SELECT count(*)::int AS n FROM assignments WHERE meeting_id = ${w1}`)[0].n, 0);
    assert.equal((await sql`SELECT count(*)::int AS n FROM class_meeting_marks WHERE meeting_id = ${w1}`)[0].n, 0);
    assert.equal((await sql`SELECT count(*)::int AS n FROM class_meeting_marks WHERE meeting_id = ${w2}`)[0].n, 1);
    // deleting the semester removes its meetings
    await sql`DELETE FROM academic_semesters WHERE id = ${sem}`;
    assert.equal((await sql`SELECT count(*)::int AS n FROM class_meetings WHERE academic_semester_id = ${sem}`)[0].n, 0);

    console.log("all class work checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("CLASS WORK CHECK FAILED:", e);
  process.exit(1);
});
