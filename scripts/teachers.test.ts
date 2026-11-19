import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { PHOTO_MAX_BYTES } from "../lib/photo";
import { getTeacher, insertTeacher, listTeachers, parseIds, parseTeacher } from "../lib/teacher";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const base = { fullName: " Ada Lovelace ", dateOfBirth: "1990-05-01", email: "Test.Teacher@Example.com" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const cleanup = async () => {
  await sql`DELETE FROM teachers WHERE email LIKE '%@tchtest.example.com' OR email = 'test.teacher@example.com'`;
  await sql`DELETE FROM users WHERE email LIKE '%@tchtest.example.com' OR email = 'test.teacher@example.com'`;
};

(async () => {
  await cleanup();
  try {
    // id parsing ignores junk and duplicates
    assert.deepEqual(parseIds(["3", "3", "x", "-1", "0", "7"]), [3, 7]);

    // validation (teachers have no subjects of their own: those are set per academic semester)
    assert.deepEqual(parseTeacher(fd(base)).data, {
      fullName: "Ada Lovelace", dateOfBirth: "1990-05-01", email: "test.teacher@example.com", photo: null,
    });
    assert.ok(parseTeacher(fd({ ...base, fullName: "" })).errors?.fullName);
    assert.ok(parseTeacher(fd({ ...base, dateOfBirth: "2026-02-31" })).errors?.dateOfBirth);
    assert.ok(parseTeacher(fd({ ...base, dateOfBirth: "2999-01-01" })).errors?.dateOfBirth);
    assert.ok(parseTeacher(fd({ ...base, email: "nope" })).errors?.email);

    assert.equal((await insertTeacher(fd(base))).message, "Registered Ada Lovelace.");
    const [ada] = await sql`SELECT id FROM teachers WHERE email = 'test.teacher@example.com'`;
    assert.equal((await getTeacher(ada.id as number))!.full_name, "Ada Lovelace");

    // duplicate email
    assert.match((await insertTeacher(fd(base))).errors?.email ?? "", /already registered/);

    // listing: paging and filters
    for (let i = 0; i < 12; i++)
      await insertTeacher(fd({ fullName: `TchTest ${String(i).padStart(2, "0")}`, dateOfBirth: "1980-01-01", email: `t${i}@tchtest.example.com` }));
    const p1 = await listTeachers({ name: "tchtest", page: 1 });
    assert.equal(p1.total, 12);
    assert.equal(p1.teachers.length, 10);
    assert.equal((await listTeachers({ name: "tchtest", page: 2 })).teachers.length, 2);
    assert.equal((await listTeachers({ email: "@TCHTEST.example" })).total, 12);
    assert.equal((await listTeachers({ email: "t1@tchtest" })).total, 1);

    console.log("all teacher checks passed");

    // optional photo: typed, size-limited, stored with the row
    const withPic = (file: File) => { const f = fd({ ...base, email: "pic@tchtest.example.com" }); f.set("photo", file); return f; };
    assert.ok(parseTeacher(withPic(new File([PNG], "a.gif", { type: "image/gif" }))).errors?.photo);
    assert.ok(parseTeacher(withPic(new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "b.png", { type: "image/png" }))).errors?.photo);
    assert.equal((await insertTeacher(withPic(new File([PNG], "a.png", { type: "image/png" })))).message, "Registered Ada Lovelace.");
    const [p] = await sql`SELECT id, photo_type, encode(photo, 'base64') AS b64 FROM teachers WHERE email = 'pic@tchtest.example.com'`;
    assert.equal(p.photo_type, "image/png");
    assert.equal(Buffer.from(p.b64 as string, "base64").equals(PNG), true);
    assert.equal((await getTeacher(p.id as number))?.has_photo, true);
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("TEACHER CHECK FAILED:", e);
  process.exit(1);
});
