// Checks of academic semesters against the real database. Test rows: years 2085–2100, @tchtest teachers,
// "TchTest" subjects; all removed at the end, real rows untouched.
import assert from "node:assert/strict";
import { sql } from "../lib/db";
import {
  academicSemesterDbError, academicSemesterValues, createAcademicSemester, getAcademicSemester, listAcademicSemesters,
  parseAcademicSemester, semesterSubjectBatches, subjectInSemester, updateAcademicSemester,
} from "../lib/academic-semester";
import { bindBatch } from "../lib/grading";

const cleanup = async () => {
  await sql`DELETE FROM academic_semesters WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE first_name = 'Semtest' AND enrollment_date >= '2085-01-01'`;
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM teachers WHERE email LIKE '%@tchtest.example.com'`;
  await sql`DELETE FROM users WHERE email LIKE '%@tchtest.example.com'`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest %'`;
};
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) [v].flat().forEach((x) => f.append(k, x));
  return f;
};
const caught = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } throw new Error("expected a rejection"); };
const ids = async (q: ReturnType<typeof sql>) => (await q).map((r) => r.id as number);

(async () => {
  await cleanup();
  try {
    const [b1, b2, b3] = await ids(sql`INSERT INTO batches (number, year, semester) VALUES (1, 2085, 1), (2, 2085, 2), (3, 2086, 1) RETURNING id`);
    await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date, batch_id)
      VALUES ('Semtest', 'One', '2000-01-01', 'audit', '2085-08-01', ${b1}), ('Semtest', 'Two', '2000-01-01', 'audit', '2085-08-01', ${b1}),
             ('Semtest', 'Three', '2000-01-01', 'audit', '2085-02-01', ${b2})`;
    const [ada, bob] = await ids(sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES
      ('TchTest Ada', '1980-01-01', 'ada@tchtest.example.com'), ('TchTest Bob', '1980-01-01', 'bob@tchtest.example.com') RETURNING id`);
    const [art, music, drama] = await ids(sql`INSERT INTO subjects (name) VALUES ('TchTest Art'), ('TchTest Music'), ('TchTest Drama') RETURNING id`);

    // parsing
    const form = (o: Record<string, string | string[]> = {}) => fd({
      year: "2090", semester: "1", batchIds: [String(b1), String(b2), String(b1)], teacherIds: [String(ada), String(bob)],
      [`subjects-${ada}`]: [String(art), String(music)], [`subjects-${bob}`]: [String(art)], ...o,
    });
    const p = parseAcademicSemester(form());
    assert.deepEqual(p.data, { year: 2090, semester: 1, batchIds: [b1, b2],
      teachers: [{ teacherId: ada, subjectIds: [art, music] }, { teacherId: bob, subjectIds: [art] }] });
    assert.ok(parseAcademicSemester(form({ year: "1999" })).errors?.year);
    assert.ok(parseAcademicSemester(form({ semester: "3" })).errors?.semester);
    assert.ok(parseAcademicSemester(form({ [`subjects-${bob}`]: [] })).errors?.[`teacher-${bob}`]);
    assert.ok(parseAcademicSemester(fd({ year: "2090", semester: "2" })).data, "batches and teachers are optional");
    assert.deepEqual(JSON.parse(academicSemesterValues(form()).teachers)[0], { teacherId: ada, subjectIds: [art, music] });

    // create (one subject for two teachers is fine), get, list
    const id = await createAcademicSemester(p.data!);
    let g = await getAcademicSemester(id);
    assert.deepEqual(g, { id, year: 2090, semester: 1, batchIds: [b1, b2].sort((a, b) => a - b),
      teachers: [{ teacherId: ada, subjectIds: [art, music] }, { teacherId: bob, subjectIds: [art] }] });
    const [row] = (await listAcademicSemesters({ year: 2090 })).semesters;
    assert.equal(row.students, 3);
    assert.equal(row.teachers, 2);
    assert.equal(row.subjects, 2);
    assert.deepEqual(row.batches.map((b: { number: number }) => b.number), [1, 2]);

    // duplicate period refused, nothing half-saved
    const dup = await caught(createAcademicSemester({ year: 2090, semester: 1, batchIds: [b3], teachers: [] }));
    assert.match((await academicSemesterDbError(dup, { year: 2090, semester: 1 })).period, /already registered for 2090 – 1st semester/);
    assert.equal((await listAcademicSemesters({ year: 2090 })).total, 1);

    // a deleted subject while saving: error, nothing saved
    const gone = await caught(createAcademicSemester({ year: 2091, semester: 1, batchIds: [b1], teachers: [{ teacherId: ada, subjectIds: [2147483000] }] }));
    assert.ok((await academicSemesterDbError(gone, { year: 2091, semester: 1 })).form);
    assert.equal((await listAcademicSemesters({ year: 2091 })).total, 0);

    // the same batch can be in several semesters
    const other = await createAcademicSemester({ year: 2090, semester: 2, batchIds: [b1], teachers: [] });

    // assigning batches to subjects: a subject counts as unassigned until it has a batch still in the semester
    const unassigned = async () => (await listAcademicSemesters({ year: 2090 })).semesters.find((r) => r.id === id)!.unassigned;
    assert.equal(await unassigned(), 2);
    assert.equal(await subjectInSemester(id, art), true);
    assert.equal(await subjectInSemester(id, drama), false, "drama isn't taught in this semester");
    assert.equal(await bindBatch(id, art, b1), true);
    assert.equal(await bindBatch(id, music, b3), false, "a batch outside the semester can't be assigned");
    assert.equal(await unassigned(), 1);
    assert.equal(await bindBatch(id, music, b2), true);
    assert.equal(await unassigned(), 0);
    let sb = await semesterSubjectBatches(id);
    assert.deepEqual(sb!.period, { year: 2090, semester: 1 });
    assert.deepEqual(sb!.batches.map((x) => [x.id, x.students]), [[b1, 2], [b2, 1]]);
    assert.deepEqual(sb!.subjects.map((x) => [x.name, x.bound, x.teachers.map((t) => t.name)]),
      [["TchTest Art", [b1], ["TchTest Ada", "TchTest Bob"]], ["TchTest Music", [b2], ["TchTest Ada"]]]);
    await updateAcademicSemester(id, { year: 2090, semester: 1, batchIds: [b1], teachers: p.data!.teachers });
    assert.equal(await unassigned(), 1, "a bound batch that left the semester doesn't count");
    sb = await semesterSubjectBatches(id);
    assert.deepEqual(sb!.subjects.find((x) => x.name === "TchTest Music")!.bound, []);
    assert.deepEqual((await semesterSubjectBatches(other))!.subjects, [], "a semester with no subjects");
    assert.equal(await semesterSubjectBatches(2147483000), null);

    // update replaces batches and teacher subjects; moving onto a taken period is refused
    assert.equal(await updateAcademicSemester(id, { year: 2090, semester: 1, batchIds: [b3], teachers: [{ teacherId: bob, subjectIds: [drama] }] }), true);
    g = await getAcademicSemester(id);
    assert.deepEqual(g!.batchIds, [b3]);
    assert.deepEqual(g!.teachers, [{ teacherId: bob, subjectIds: [drama] }]);
    await assert.rejects(updateAcademicSemester(other, { year: 2090, semester: 1, batchIds: [], teachers: [] }), (e: { code?: string }) => e.code === "23505");
    assert.deepEqual((await getAcademicSemester(other))!.batchIds, [b1], "a refused update keeps the old rows");
    assert.equal(await updateAcademicSemester(2147483000, { year: 2099, semester: 1, batchIds: [b1], teachers: [] }), false);
    assert.equal((await sql`SELECT count(*)::int AS n FROM academic_semester_batches WHERE academic_semester_id = 2147483000`)[0].n, 0);

    // deleting a batch, teacher or subject takes it out of the semesters; the semester stays
    await updateAcademicSemester(id, { year: 2090, semester: 1, batchIds: [b2, b3], teachers: [{ teacherId: ada, subjectIds: [art] }, { teacherId: bob, subjectIds: [drama, music] }] });
    await sql`DELETE FROM batches WHERE id = ${b3}`;
    await sql`DELETE FROM teachers WHERE id = ${ada}`;
    await sql`DELETE FROM subjects WHERE id = ${drama}`;
    g = await getAcademicSemester(id);
    assert.deepEqual(g!.batchIds, [b2]);
    assert.deepEqual(g!.teachers, [{ teacherId: bob, subjectIds: [music] }]);

    // deleting the semester keeps batches, teachers and subjects
    await sql`DELETE FROM academic_semesters WHERE id = ${id}`;
    assert.equal((await sql`SELECT count(*)::int AS n FROM batches WHERE id = ${b2}`)[0].n, 1);
    assert.equal((await sql`SELECT count(*)::int AS n FROM teachers WHERE id = ${bob}`)[0].n, 1);
    assert.equal((await sql`SELECT count(*)::int AS n FROM subjects WHERE id = ${music}`)[0].n, 1);
    assert.equal((await sql`SELECT count(*)::int AS n FROM academic_semester_teacher_subjects WHERE academic_semester_id = ${id}`)[0].n, 0);

    console.log("all academic semester checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("ACADEMIC SEMESTER CHECK FAILED:", e);
  process.exit(1);
});
