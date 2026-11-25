import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { batchDbError, batchLabel, createBatch, duplicatePeriodMessage, eligibleStudents, getBatch, isDuplicateBatch, listBatches, ordinal, parseBatch, updateBatch } from "../lib/batch";

const fd = (o: Record<string, string>, ids: (number | string)[] = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  ids.forEach((id) => f.append("studentIds", String(id)));
  return f;
};
// test batches live in years 2085-2100, which real data never has; a year and semester can hold only one batch
const cleanup = async () => {
  await sql`DELETE FROM batches WHERE year >= 2085`;
  await sql`DELETE FROM students WHERE last_name LIKE 'BatchTest %'`;
};
const expectDbError = async (p: Promise<unknown>, field: string) => {
  try {
    await p;
  } catch (e) {
    assert.ok(batchDbError(e)[field], `expected a ${field} error, got ${(e as Error).message}`);
    return;
  }
  assert.fail(`expected a ${field} error`);
};

(async () => {
  await cleanup();
  try {
    // ordinals and labels
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal),
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
    assert.equal(batchLabel({ number: 1, year: 2026, semester: 2 }), "1st batch, 2026 – 2nd semester");

    // validation
    assert.deepEqual(parseBatch(fd({ number: "3", year: "2026", semester: "2" }, [5, 5, "x"])).data,
      { number: 3, year: 2026, semester: 2, studentIds: [5] });
    assert.ok(parseBatch(fd({ number: "0", year: "2026", semester: "1" })).errors?.number);
    assert.ok(parseBatch(fd({ number: "1.5", year: "2026", semester: "1" })).errors?.number);
    assert.ok(parseBatch(fd({ number: "1", year: "1999", semester: "1" })).errors?.year);
    assert.ok(parseBatch(fd({ number: "1", year: "2026", semester: "3" })).errors?.semester);
    assert.ok(parseBatch(fd({ number: "1", year: "2026", semester: "" })).errors?.semester);

    // students: two active, one inactive (inactive students can be in a batch as history), one that will already sit in another batch
    const s = await sql`INSERT INTO students (first_name, last_name, date_of_birth, status, enrollment_date) VALUES
      ('Amy', 'BatchTest A', '2000-03-01', 'full_time', '2024-08-01'),
      ('Ben', 'BatchTest B', '1990-01-01', 'audit', '2024-08-01'),
      ('Cal', 'BatchTest C', '1995-01-01', 'inactive', '2024-08-01'),
      ('Dee', 'BatchTest D', '1998-01-01', 'full_time', '2024-08-01') RETURNING id, last_name`;
    const id = (l: string) => s.find((r) => r.last_name === `BatchTest ${l}`)!.id as number;
    const [a, bId, c, d] = [id("A"), id("B"), id("C"), id("D")];

    // eligibility: anyone in no batch yet, whatever the status; age is computed
    let eligible = (await eligibleStudents()).filter((x) => x.name.includes("BatchTest"));
    assert.deepEqual(eligible.map((x) => x.id).sort(), [a, bId, c, d].sort());
    assert.equal(eligible.find((x) => x.id === c)!.status, "inactive");
    const ben = eligible.find((x) => x.id === bId)!;
    assert.equal(ben.age, new Date().getFullYear() - 1990 - (new Date() < new Date(new Date().getFullYear(), 0, 1) ? 1 : 0));
    assert.equal(ben.hasPhoto, false);

    // create with D, then D is no longer eligible
    const other = await createBatch({ number: 901, year: 2090, semester: 1, studentIds: [d] });
    eligible = (await eligibleStudents()).filter((x) => x.name.includes("BatchTest"));
    assert.deepEqual(eligible.map((x) => x.id).sort(), [a, bId, c].sort());

    // all or nothing: a student already in another batch fails the whole create
    await expectDbError(createBatch({ number: 902, year: 2090, semester: 2, studentIds: [a, d] }), "studentIds");
    assert.equal((await sql`SELECT id FROM batches WHERE year = 2090 AND semester = 2`).length, 0);
    assert.equal((await sql`SELECT batch_id FROM students WHERE id = ${a}`)[0].batch_id, null);

    // an inactive student can join a batch (history), and then is no longer offered elsewhere
    const history = await createBatch({ number: 906, year: 2091, semester: 1, studentIds: [c] });
    assert.deepEqual((await getBatch(history))!.student_ids, [c]);
    assert.equal((await sql`SELECT status FROM students WHERE id = ${c}`)[0].status, "inactive");

    // create with A and B
    const main = await createBatch({ number: 902, year: 2091, semester: 2, studentIds: [a, bId] });
    assert.deepEqual([...((await getBatch(main))!.student_ids as number[])].sort(), [a, bId].sort());

    // a year and semester can have only one batch, whatever its number
    for (const number of [902, 777]) {
      try {
        await createBatch({ number, year: 2091, semester: 2, studentIds: [] });
        assert.fail("expected a duplicate period error");
      } catch (e) {
        assert.ok(isDuplicateBatch(e), (e as Error).message);
      }
    }
    assert.equal(
      await duplicatePeriodMessage(2091, 2),
      "The 902nd batch is already registered for 2091 – 2nd semester. Each year and semester can have only one batch. Choose another year or semester, or edit that batch.",
    );
    assert.match(await duplicatePeriodMessage(2099, 1), /^A batch is already registered for 2099 – 1st semester\./);
    // the same number in another period is fine, and so is the other semester of the same year
    const empty = await createBatch({ number: 902, year: 2092, semester: 1, studentIds: [] });
    assert.equal((await getBatch(empty))!.student_ids.length, 0);
    await createBatch({ number: 907, year: 2092, semester: 2, studentIds: [] });

    // edit: the batch's own members are offered, plus free eligible students
    const forEdit = (await eligibleStudents(main)).filter((x) => x.name.includes("BatchTest")).map((x) => x.id);
    assert.deepEqual(forEdit.sort(), [a, bId].sort());

    // update: moving a batch onto a period another batch holds is refused, and nothing changes
    try {
      await updateBatch(main, { number: 903, year: 2090, semester: 1, studentIds: [a, bId] });
      assert.fail("expected a duplicate period error");
    } catch (e) {
      assert.ok(isDuplicateBatch(e), (e as Error).message);
    }
    assert.deepEqual([(await getBatch(main))!.year, (await getBatch(main))!.semester], [2091, 2]);

    // update: drop B, move to a free period, rename; B becomes free again
    assert.equal(await updateBatch(main, { number: 903, year: 2093, semester: 1, studentIds: [a] }), true);
    const after = (await getBatch(main))!;
    assert.deepEqual([after.number, after.year, after.semester, after.student_ids], [903, 2093, 1, [a]]);
    assert.equal((await sql`SELECT batch_id FROM students WHERE id = ${bId}`)[0].batch_id, null);

    // update stays all or nothing: adding D (in another batch) changes nothing
    await expectDbError(updateBatch(main, { number: 904, year: 2093, semester: 1, studentIds: [a, d] }), "studentIds");
    assert.equal((await getBatch(main))!.number, 903);

    // a member who later turns inactive can stay in the batch
    await sql`UPDATE students SET status = 'inactive' WHERE id = ${a}`;
    assert.equal(await updateBatch(main, { number: 903, year: 2093, semester: 1, studentIds: [a] }), true); // its own period is not a clash

    // a missing batch
    assert.equal(await updateBatch(2147483000, { number: 905, year: 2094, semester: 1, studentIds: [] }), false);

    // list: filters by number and year, newest first, paged by 10 (11 batches over 2095-2100, two semesters a year)
    for (let i = 0; i < 11; i++) await createBatch({ number: 950 + i, year: 2095 + Math.floor(i / 2), semester: (1 + (i % 2)) as 1 | 2, studentIds: [] });
    const p1 = await listBatches({});
    assert.ok(p1.total >= 11, `total ${p1.total}`);
    assert.equal(p1.batches.length, 10);
    assert.equal((await listBatches({ page: 2 })).batches.length, Math.min(10, p1.total - 10));
    assert.equal((await listBatches({ year: 2095 })).total, 2);
    assert.deepEqual((await listBatches({ year: 2095 })).batches.map((b) => b.semester), [2, 1]); // newest first
    assert.equal((await listBatches({ number: 955, year: 2097 })).total, 1);
    const listed = (await listBatches({ number: 903 })).batches[0];
    assert.equal(listed.students, 1);
    assert.deepEqual((await listBatches({ student: "amy batchtest" })).batches.map((b) => b.number), [903], "by a member's name, any case");
    assert.equal((await listBatches({ student: "Nobody BatchTest Zzz" })).total, 0);

    // deleting a batch keeps its students and frees them
    await sql`DELETE FROM batches WHERE id = ${other}`;
    assert.equal((await sql`SELECT batch_id FROM students WHERE id = ${d}`)[0].batch_id, null);
    assert.equal((await sql`SELECT count(*)::int AS n FROM students WHERE id = ${d}`)[0].n, 1);

    console.log("all batch checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("BATCH CHECK FAILED:", e);
  process.exit(1);
});
