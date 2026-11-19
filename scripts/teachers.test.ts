import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { PHOTO_MAX_BYTES } from "../lib/photo";
import { getTeacher, insertTeacher, listTeachers, parseIds, parseTeacher } from "../lib/teacher";

const fd = (o: Record<string, string>, subjectIds: (number | string)[] = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  subjectIds.forEach((id) => f.append("subjectIds", String(id)));
  return f;
};
const base = { fullName: " Ada Lovelace ", dateOfBirth: "1990-05-01", email: "Test.Teacher@Example.com" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const cleanup = async () => {
  await sql`DELETE FROM teachers WHERE email LIKE '%@tchtest.example.com' OR email = 'test.teacher@example.com'`;
  await sql`DELETE FROM users WHERE email LIKE '%@tchtest.example.com' OR email = 'test.teacher@example.com'`;
  await sql`DELETE FROM subjects WHERE name LIKE 'TchTest %'`;
};

(async () => {
  await cleanup();
  const subj = await sql`INSERT INTO subjects (name) VALUES ('TchTest Art'), ('TchTest Music'), ('TchTest Drama') RETURNING id, name`;
  const id = (n: string) => subj.find((s) => s.name === `TchTest ${n}`)!.id as number;
  const [art, music, drama] = [id("Art"), id("Music"), id("Drama")];

  try {
    // id parsing ignores junk and duplicates
    assert.deepEqual(parseIds(["3", "3", "x", "-1", "0", "7"]), [3, 7]);

    // validation
    assert.deepEqual(parseTeacher(fd(base, [art, art, music])).data, {
      fullName: "Ada Lovelace", dateOfBirth: "1990-05-01", email: "test.teacher@example.com", subjectIds: [art, music], photo: null,
    });
    assert.ok(parseTeacher(fd({ ...base, fullName: "" }, [art])).errors?.fullName);
    assert.ok(parseTeacher(fd({ ...base, dateOfBirth: "2026-02-31" }, [art])).errors?.dateOfBirth);
    assert.ok(parseTeacher(fd({ ...base, dateOfBirth: "2999-01-01" }, [art])).errors?.dateOfBirth);
    assert.ok(parseTeacher(fd({ ...base, email: "nope" }, [art])).errors?.email);
    assert.ok(parseTeacher(fd(base, [])).errors?.subjectIds);

    // create links the chosen subjects
    assert.equal((await insertTeacher(fd(base, [art, music]))).message, "Registered Ada Lovelace.");
    const [ada] = await sql`SELECT id FROM teachers WHERE email = 'test.teacher@example.com'`;
    const got = await getTeacher(ada.id as number);
    assert.deepEqual([...(got!.subject_ids as number[])].sort(), [art, music].sort());

    // duplicate email
    assert.match((await insertTeacher(fd(base, [art]))).errors?.email ?? "", /already registered/);

    // unknown subject: error, and no half-saved teacher
    const bad = await insertTeacher(fd({ ...base, email: "ghost@tchtest.example.com" }, [art, 2147483000]));
    assert.match(bad.errors?.subjectIds ?? "", /no longer exists/);
    assert.equal((await sql`SELECT id FROM teachers WHERE email = 'ghost@tchtest.example.com'`).length, 0);

    // listing: 12 teachers, 3 teach Art, 9 teach Music; paging and filters
    for (let i = 0; i < 12; i++)
      await insertTeacher(fd({ fullName: `TchTest ${String(i).padStart(2, "0")}`, dateOfBirth: "1980-01-01", email: `t${i}@tchtest.example.com` }, [i < 3 ? art : music]));
    const p1 = await listTeachers({ name: "tchtest", page: 1 });
    assert.equal(p1.total, 12);
    assert.equal(p1.teachers.length, 10);
    assert.equal((await listTeachers({ name: "tchtest", page: 2 })).teachers.length, 2);
    assert.equal((await listTeachers({ email: "@TCHTEST.example" })).total, 12);
    assert.equal((await listTeachers({ email: "t1@tchtest" })).total, 1);
    assert.equal((await listTeachers({ subjectIds: [art] })).total, 3 + 1); // + Ada
    assert.equal((await listTeachers({ name: "tchtest", subjectIds: [art, music] })).total, 12);
    assert.equal((await listTeachers({ subjectIds: [drama] })).total, 0);
    const adaRow = (await listTeachers({ email: "test.teacher@example.com" })).teachers[0];
    assert.deepEqual(adaRow.subjects, ["TchTest Art", "TchTest Music"]);

    // deleting a subject unlinks it from teachers (cascade)
    await sql`DELETE FROM subjects WHERE id = ${music}`;
    assert.deepEqual((await getTeacher(ada.id as number))!.subject_ids, [art]);

    console.log("all teacher checks passed");

    // optional photo: typed, size-limited, stored with the row
    const withPic = (file: File) => { const f = fd({ ...base, email: "pic@tchtest.example.com" }, [art]); f.set("photo", file); return f; };
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
