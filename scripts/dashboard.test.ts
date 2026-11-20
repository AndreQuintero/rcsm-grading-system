// Checks of the admin dashboard data. Test rows: years 2085+, @tchtest teachers, "Dashtest" students, "TchTest"
// subjects; all removed at the end.
import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { dashboardCounts, periodKey, pickDefault, rankStudents, semesterChoices, semesterDetail, semesterRanking } from "../lib/dashboard";

const cleanup = async () => {
  await sql`DELETE FROM academic_semesters WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE first_name = 'Dashtest'`;
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM teachers WHERE email LIKE '%@tchtest.example.com'`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest %'`;
};

(async () => {
  await cleanup();
  try {
    // time order and the default rule (pure)
    const c = (id: number, year: number, semester: number) => ({ id, year, semester });
    assert.ok(periodKey({ year: 2026, semester: 2 }) < periodKey({ year: 2026, semester: 1 }), "Jan–May comes before Jun–Dec");
    const all = [c(1, 2025, 1), c(2, 2026, 2), c(3, 2026, 1), c(4, 2027, 2)];
    assert.equal(pickDefault(all, "2026-03-10")!.id, 2, "running today");
    assert.equal(pickDefault(all, "2026-09-01")!.id, 3);
    assert.equal(pickDefault([c(1, 2025, 1), c(4, 2027, 2)], "2026-03-10")!.id, 1, "else the latest started");
    assert.equal(pickDefault([c(4, 2027, 2), c(5, 2027, 1)], "2026-03-10")!.id, 4, "all future: the nearest");
    assert.equal(pickDefault([], "2026-03-10"), null);

    // ranking (pure): dense places, name tie-break, everyone tied with the size-th kept
    const r = (name: string, score: number) => ({ name, score });
    const ranked = rankStudents([r("Eve", 80), r("Bob", 98), r("Al", 98), r("Cy", 95), r("Di", 80), r("Fi", 70)], 4);
    assert.deepEqual(ranked.map((x) => [x.name, x.place]), [["Al", 1], ["Bob", 1], ["Cy", 2], ["Di", 3], ["Eve", 3]]);
    assert.equal(rankStudents([r("A", 1), r("B", 2)], 5).length, 2, "fewer rows than the size");
    assert.deepEqual(rankStudents([], 5), []);

    const before = await dashboardCounts();
    const [b1] = await sql`INSERT INTO batches (number, year, semester) VALUES (9, 2085, 1) RETURNING id`;
    await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, batch_id) VALUES
      ('Dashtest', 'Active', '2000-01-01', 'full_time', '2085-08-01', ${b1.id}),
      ('Dashtest', 'Audit', '2000-01-01', 'audit', '2085-08-01', ${b1.id}),
      ('Dashtest', 'Gone', '2000-01-01', 'inactive', '2085-08-01', ${b1.id})`;
    const [t1] = await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES ('TchTest Dash', '1980-01-01', 'dash@tchtest.example.com') RETURNING id`;
    const [s1, s2] = await sql`INSERT INTO subjects (name) VALUES ('TchTest B Worship'), ('TchTest A Bible') RETURNING id`;
    const after = await dashboardCounts();
    assert.equal(after.students - before.students, 3);
    assert.equal(after.inactive - before.inactive, 1);
    assert.equal(after.teachers - before.teachers, 1);
    assert.equal(after.subjects - before.subjects, 2);

    const [a2] = await sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 2) RETURNING id`;
    const [a1] = await sql`INSERT INTO academic_semesters (year, semester) VALUES (2090, 1) RETURNING id`;
    const ids = (await semesterChoices()).map((x) => x.id);
    assert.ok(ids.indexOf(a1.id) < ids.indexOf(a2.id), "2090 1st (Jun–Dec) is newer than 2090 2nd");

    await sql`INSERT INTO academic_semester_batches VALUES (${a1.id}, ${b1.id})`;
    await sql`INSERT INTO academic_semester_teacher_subjects VALUES (${a1.id}, ${t1.id}, ${s1.id}), (${a1.id}, ${t1.id}, ${s2.id})`;
    const d = await semesterDetail(a1.id);
    assert.deepEqual(d.teachers.map((t) => [t.name, t.subjects]), [["TchTest Dash", ["TchTest A Bible", "TchTest B Worship"]]]);
    assert.equal(d.batches.length, 1);
    assert.match(d.batches[0].label, /9th batch, 2085/);
    assert.deepEqual(d.batches[0].students.map((s) => s.name).sort(), ["Dashtest Active", "Dashtest Audit"], "inactive students hidden");
    // ranking: average of subject totals; inactive and ungraded rows left out
    const st = Object.fromEntries((await sql`SELECT id, last_name FROM students WHERE first_name = 'Dashtest'`).map((x) => [x.last_name, x.id]));
    await sql`INSERT INTO grades (academic_semester_id, subject_id, student_id, midterm, participation, presence, final_exam) VALUES
      (${a1.id}, ${s1.id}, ${st.Active}, 20, 20, 20, 20), (${a1.id}, ${s2.id}, ${st.Active}, 25, 25, NULL, NULL),
      (${a1.id}, ${s1.id}, ${st.Audit}, 10, NULL, NULL, NULL), (${a1.id}, ${s2.id}, ${st.Audit}, NULL, NULL, NULL, NULL),
      (${a1.id}, ${s1.id}, ${st.Gone}, 25, 25, 25, 25)`;
    const rank = await semesterRanking(a1.id);
    assert.deepEqual(rank.map((x) => [x.name, x.score, x.subjects, x.place]), [["Dashtest Active", 65, 2, 1], ["Dashtest Audit", 10, 1, 2]]);
    assert.match(rank[0].batch!, /9th batch, 2085/);
    assert.deepEqual(await semesterRanking(a2.id), []);
    const empty = await semesterDetail(a2.id);
    assert.deepEqual(empty, { teachers: [], batches: [] });

    console.log("all dashboard checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("DASHBOARD CHECK FAILED:", e);
  process.exit(1);
});
