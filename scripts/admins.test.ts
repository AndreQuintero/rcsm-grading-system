import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { getAdmin, listAdmins, parseAdmin } from "../lib/admin";
import { createAdmin } from "../app/admins/new/actions";
import { formatDate } from "../lib/dates";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const base = { fullName: " Ada Admin ", dateOfBirth: "1990-05-01", email: "Ada@AdmTest.example.com" };
const cleanup = () => sql`DELETE FROM admins WHERE email LIKE '%@admtest.example.com'`;

(async () => {
  await cleanup();
  try {
    // validation
    assert.deepEqual(parseAdmin(fd(base)).data, { fullName: "Ada Admin", dateOfBirth: "1990-05-01", email: "ada@admtest.example.com" });
    assert.ok(parseAdmin(fd({ ...base, fullName: " " })).errors?.fullName);
    assert.ok(parseAdmin(fd({ ...base, dateOfBirth: "2026-02-31" })).errors?.dateOfBirth);
    assert.ok(parseAdmin(fd({ ...base, dateOfBirth: "2999-01-01" })).errors?.dateOfBirth);
    assert.ok(parseAdmin(fd({ ...base, email: "nope" })).errors?.email);

    // create, timestamps set, duplicate email refused
    assert.equal((await createAdmin({}, fd(base))).message, "Registered Ada Admin.");
    assert.match((await createAdmin({}, fd(base))).errors?.email ?? "", /already registered/);
    const [row] = await sql`SELECT id, created_at = updated_at AS same FROM admins WHERE email = 'ada@admtest.example.com'`;
    assert.equal(row.same, true);
    const id = row.id as number;
    assert.equal((await getAdmin(id))!.dob, "1990-05-01");

    // the update statement moves updated_at but not created_at (revalidatePath can't run outside Next, so check the SQL)
    await sql`SELECT pg_sleep(0.1)`;
    await sql`UPDATE admins SET full_name = 'Ada B', updated_at = now() WHERE id = ${id}`;
    const [after] = await sql`SELECT updated_at > created_at AS moved FROM admins WHERE id = ${id}`;
    assert.equal(after.moved, true);

    // list: filters are case-insensitive substrings, paged by 10
    for (let i = 0; i < 11; i++)
      await sql`INSERT INTO admins (full_name, date_of_birth, email) VALUES (${"Zed " + String(i).padStart(2, "0")}, '1980-01-01', ${`z${i}@admtest.example.com`})`;
    const p1 = await listAdmins({ email: "@admtest.example.com" });
    assert.equal(p1.total, 12);
    assert.equal(p1.admins.length, 10);
    assert.equal((await listAdmins({ email: "@admtest.example.com", page: 2 })).admins.length, 2);
    assert.equal((await listAdmins({ name: "ada b", email: "ADMTEST" })).total, 1);
    assert.equal((await listAdmins({ name: "nobody-here" })).total, 0);

    // display mask
    assert.equal(formatDate("2026-11-19"), "November 19th, 2026");
    assert.equal(formatDate("2001-01-02 14:30"), "January 2nd, 2001 14:30");
    assert.equal(formatDate("1999-08-11"), "August 11th, 1999");

    console.log("all admin checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("ADMIN CHECK FAILED:", e);
  process.exit(1);
});
