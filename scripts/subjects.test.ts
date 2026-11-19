import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { getSubject, insertSubjects as createSubjects, listSubjectPage } from "../lib/subject";

(async () => {
  await sql`DELETE FROM subjects WHERE name LIKE 'TestSubj %'`;

  // trims, drops blanks, removes duplicates in the input
  const first = await createSubjects(["  TestSubj Math ", "", "TestSubj Art", "TestSubj Math"]);
  assert.equal(first.message, "Added 2 subjects.");
  const rows = await sql`SELECT name FROM subjects WHERE name LIKE 'TestSubj %' ORDER BY name`;
  assert.deepEqual(rows.map((r) => r.name), ["TestSubj Art", "TestSubj Math"]);

  // existing names are reported, not duplicated
  const again = await createSubjects(["TestSubj Art", "TestSubj Music"]);
  assert.equal(again.message, "Added 1 subject. Already existed: TestSubj Art.");

  // validation
  assert.match((await createSubjects(["", "   "])).errors ?? "", /at least one/);
  assert.match((await createSubjects(["x".repeat(101)])).errors ?? "", /100 characters/);

  // listing: 12 rows, paging and name filter
  await sql`DELETE FROM subjects WHERE name LIKE 'PageSubj %'`;
  for (let i = 0; i < 12; i++) await sql`INSERT INTO subjects (name) VALUES (${`PageSubj ${String(i).padStart(2, "0")}`})`;
  const p1 = await listSubjectPage({ name: "pagesubj", page: 1 });
  assert.equal(p1.total, 12);
  assert.equal(p1.subjects.length, 10);
  const p2 = await listSubjectPage({ name: "pagesubj", page: 2 });
  assert.equal(p2.subjects.length, 2);
  const one = await getSubject(p2.subjects[0].id as number);
  assert.equal(one?.name, p2.subjects[0].name);
  assert.equal(await getSubject(2147483000), null);
  await sql`DELETE FROM subjects WHERE name LIKE 'PageSubj %'`;

  await sql`DELETE FROM subjects WHERE name LIKE 'TestSubj %'`;
  console.log("all subject checks passed");
})().catch((e) => {
  console.error("SUBJECT CHECK FAILED:", e);
  process.exit(1);
});
