import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { createSubjects } from "../app/subjects/new/actions";

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

  await sql`DELETE FROM subjects WHERE name LIKE 'TestSubj %'`;
  console.log("all subject checks passed");
})().catch((e) => {
  console.error("SUBJECT CHECK FAILED:", e);
  process.exit(1);
});
