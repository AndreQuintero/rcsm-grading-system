import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { parseTeacher } from "../lib/teacher";
import { createTeacher } from "../app/teachers/new/actions";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const ok = {
  fullName: " Ada Lovelace ",
  dateOfBirth: "1990-05-01",
  email: "Test.Teacher@Example.com",
  subjects: "Math\n Physics \n\nMath",
};

(async () => {
  // validation
  assert.deepEqual(parseTeacher(fd(ok)).data, {
    fullName: "Ada Lovelace",
    dateOfBirth: "1990-05-01",
    email: "test.teacher@example.com",
    subjects: ["Math", "Physics"],
  });
  assert.ok(parseTeacher(fd({ ...ok, fullName: "" })).errors?.fullName);
  assert.ok(parseTeacher(fd({ ...ok, dateOfBirth: "2026-02-31" })).errors?.dateOfBirth);
  assert.ok(parseTeacher(fd({ ...ok, dateOfBirth: "2999-01-01" })).errors?.dateOfBirth);
  assert.ok(parseTeacher(fd({ ...ok, email: "nope" })).errors?.email);
  assert.ok(parseTeacher(fd({ ...ok, subjects: " \n " })).errors?.subjects);

  // database round trip
  const email = "test.teacher@example.com";
  await sql`DELETE FROM teachers WHERE email = ${email}`;
  const r1 = await createTeacher({}, fd(ok));
  assert.equal(r1.message, "Registered Ada Lovelace.");
  const rows = await sql`SELECT full_name, date_of_birth::text AS dob, subjects FROM teachers WHERE email = ${email}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].full_name, "Ada Lovelace");
  assert.equal(rows[0].dob, "1990-05-01");
  assert.deepEqual(rows[0].subjects, ["Math", "Physics"]);
  const r2 = await createTeacher({}, fd(ok));
  assert.match(r2.errors?.email ?? "", /already registered/);
  await sql`DELETE FROM teachers WHERE email = ${email}`;
  console.log("all teacher checks passed");
})().catch((e) => {
  console.error("TEACHER CHECK FAILED:", e);
  process.exit(1);
});
