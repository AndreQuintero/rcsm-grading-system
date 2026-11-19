import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { parseStudent, PHOTO_MAX_BYTES } from "../lib/student";
import { createStudent } from "../app/students/new/actions";
import { getStudent, listStudents } from "../lib/student-queries";
import { batchPeriod } from "../lib/batch";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const fd = (o: Record<string, string>, photo?: File) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  if (photo) f.set("photo", photo);
  return f;
};
const base = { firstName: " Grace ", middleName: "", lastName: "TestStu Hopper", dateOfBirth: "1990-12-09", status: "inactive", enrollmentDate: "2090-08-01" };
// test batches use numbers 850-859 in years 2090-2093, which real data never has
const cleanup = async () => {
  await sql`DELETE FROM students WHERE last_name LIKE 'TestStu %'`;
  await sql`DELETE FROM batches WHERE number BETWEEN 850 AND 859`;
};

(async () => {
  await cleanup();
  try {
    // validation
    const ok = parseStudent(fd(base));
    assert.deepEqual(ok.data, {
      firstName: "Grace", middleName: null, lastName: "TestStu Hopper", dateOfBirth: "1990-12-09",
      status: "inactive", enrollmentDate: "2090-08-01", photo: null,
    });
    assert.ok(parseStudent(fd({ ...base, firstName: "" })).errors?.firstName);
    assert.ok(parseStudent(fd({ ...base, lastName: " " })).errors?.lastName);
    assert.ok(parseStudent(fd({ ...base, dateOfBirth: "2026-02-31" })).errors?.dateOfBirth);
    assert.ok(parseStudent(fd({ ...base, dateOfBirth: "2999-01-01" })).errors?.dateOfBirth);
    assert.ok(parseStudent(fd({ ...base, status: "" })).errors?.status);

    // enrollment date: required for every status, and must be a real date
    for (const status of ["audit", "full_time", "inactive"])
      assert.ok(parseStudent(fd({ ...base, status, enrollmentDate: "" })).errors?.enrollmentDate, status);
    assert.ok(parseStudent(fd({ ...base, status: "full_time", enrollmentDate: "2026-13-01" })).errors?.enrollmentDate);
    assert.equal(parseStudent(fd({ ...base, status: "full_time", enrollmentDate: "2026-01-15" })).data?.enrollmentDate, "2026-01-15");
    assert.equal(parseStudent(fd({ ...base, enrollmentDate: "2026-01-15" })).data?.enrollmentDate, "2026-01-15"); // inactive keeps it

    // photo: optional, typed and size-limited
    const pic = new File([PNG], "me.png", { type: "image/png" });
    assert.equal(parseStudent(fd(base, pic)).data?.photo?.type, "image/png");
    assert.equal(parseStudent(fd(base, new File([""], "", { type: "application/octet-stream" }))).data?.photo, null);
    assert.ok(parseStudent(fd(base, new File([PNG], "x.gif", { type: "image/gif" }))).errors?.photo);
    const big = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "big.png", { type: "image/png" });
    assert.ok(parseStudent(fd(base, big)).errors?.photo);

    // create: stores the photo bytes and the enrollment date
    assert.match((await createStudent({}, fd({ ...base, status: "audit", enrollmentDate: "2090-02-01", middleName: "Brewster" }, pic))).message ?? "",
      /^Registered Grace TestStu Hopper\./);
    const [withPhoto] = await sql`SELECT middle_name, status, enrollment_date::text AS enrolled, photo_type,
      encode(photo, 'base64') AS b64 FROM students WHERE last_name = 'TestStu Hopper'`;
    assert.equal(withPhoto.middle_name, "Brewster");
    assert.equal(withPhoto.status, "audit");
    assert.equal(withPhoto.enrolled, "2090-02-01");
    assert.equal(withPhoto.photo_type, "image/png");
    assert.equal(Buffer.from(withPhoto.b64 as string, "base64").equals(PNG), true);

    // create without a photo
    await createStudent({}, fd({ ...base, firstName: "Ada", lastName: "TestStu Byron", status: "inactive" }));
    const [noPhoto] = await sql`SELECT photo, enrollment_date::text AS enrolled FROM students WHERE last_name = 'TestStu Byron'`;
    assert.equal(noPhoto.photo, null);
    assert.equal(noPhoto.enrolled, "2090-08-01"); // an inactive student keeps its enrollment date

    // the database refuses a student without an enrollment date, whatever the status
    for (const status of ["full_time", "inactive"])
      await assert.rejects(
        sql`INSERT INTO students (first_name, last_name, date_of_birth, status) VALUES ('X', 'TestStu Bad', '2000-01-01', ${status})`,
      );

    // validation errors come back with the typed values
    const bad = await createStudent({}, fd({ ...base, status: "audit", enrollmentDate: "" }));
    assert.equal(bad.values?.firstName, " Grace ");
    assert.ok(bad.errors?.enrollmentDate);

    // the batch period an enrollment date falls in: 1st semester June-December, 2nd January-May
    assert.deepEqual(
      ["2024-08-01", "2024-06-01", "2024-12-31", "2025-01-01", "2025-05-31", "2025-03-10"].map(batchPeriod),
      [
        { year: 2024, semester: 1 }, { year: 2024, semester: 1 }, { year: 2024, semester: 1 },
        { year: 2025, semester: 2 }, { year: 2025, semester: 2 }, { year: 2025, semester: 2 },
      ],
    );

    // automatic batch on registration
    const mk = (n: number, year: number, semester: number) =>
      sql`INSERT INTO batches (number, year, semester) VALUES (${n}, ${year}, ${semester}) RETURNING id`.then((r) => r[0].id as number);
    const [first, second, dupA, dupB] = [await mk(850, 2090, 1), await mk(851, 2090, 2), await mk(852, 2091, 1), await mk(853, 2091, 1)];
    const reg = (last: string, status: string, enrollmentDate: string) =>
      createStudent({}, fd({ ...base, firstName: "Auto", lastName: `TestStu ${last}`, status, enrollmentDate }));
    const batchOf = async (last: string) => (await sql`SELECT batch_id FROM students WHERE last_name = ${`TestStu ${last}`}`)[0].batch_id;

    let r = await reg("Aug", "full_time", "2090-08-01"); // June-December -> 1st semester
    assert.equal(r.message, "Registered Auto TestStu Aug. Added to the 850th batch, 2090 – 1st semester.");
    assert.equal(await batchOf("Aug"), first);
    r = await reg("Mar", "audit", "2090-03-10"); // January-May -> 2nd semester
    assert.equal(r.message, "Registered Auto TestStu Mar. Added to the 851st batch, 2090 – 2nd semester.");
    assert.equal(await batchOf("Mar"), second);
    await reg("Dec31", "audit", "2090-12-31");
    await reg("Jan1", "audit", "2090-01-01");
    assert.deepEqual([await batchOf("Dec31"), await batchOf("Jan1")], [first, second]); // boundaries

    // inactive students are batched too, so a batch keeps its history
    r = await reg("Idle", "inactive", "2090-08-01");
    assert.equal(r.message, "Registered Auto TestStu Idle. Added to the 850th batch, 2090 – 1st semester.");
    assert.equal(await batchOf("Idle"), first);

    // no batch for that year: registered without one, and the message says why
    r = await reg("NoBatch", "full_time", "2093-08-01");
    assert.equal(r.message, "Registered Auto TestStu NoBatch. No batch exists for 2093 – 1st semester yet, so none was assigned.");
    assert.equal(await batchOf("NoBatch"), null);
    // the semester has to match too: 2090 has batches for both, 2091 only a 1st semester pair
    r = await reg("Wrong", "full_time", "2091-02-01");
    assert.match(r.message ?? "", /No batch exists for 2091 – 2nd semester/);

    // several batches in the same year and semester: no guess
    r = await reg("Many", "full_time", "2091-09-01");
    assert.match(r.message ?? "", /Several batches match 2091 – 1st semester/);
    assert.equal(await batchOf("Many"), null);
    assert.ok(dupA && dupB);

    // such a student can still be added later through the batch form's data layer
    const [many] = await sql`SELECT id FROM students WHERE last_name = 'TestStu Many'`;
    await sql`UPDATE students SET batch_id = ${dupA} WHERE id = ${many.id}`;
    assert.equal(await batchOf("Many"), dupA);

    // listing: 12 students (3 audit, 9 full time), paging, name search and status filter
    for (let i = 0; i < 12; i++) {
      const n = String(i).padStart(2, "0");
      await sql`INSERT INTO students (first_name, middle_name, last_name, date_of_birth, status, enrollment_date)
        VALUES (${`Ann${n}`}, ${i === 5 ? "Zephyrine" : null}, ${`TestStu Pg ${n}`}, '1999-09-09', ${i < 3 ? "audit" : "full_time"}, '2026-01-10')`;
    }
    const p1 = await listStudents({ name: "teststu pg" });
    assert.equal(p1.total, 12);
    assert.equal(p1.students.length, 10);
    assert.equal((await listStudents({ name: "teststu pg", page: 2 })).students.length, 2);
    assert.equal((await listStudents({ name: "zephyr" })).total, 1); // middle name
    assert.equal((await listStudents({ name: "ann03" })).total, 1); // first name
    assert.equal((await listStudents({ name: "TESTSTU PG 11" })).total, 1); // last name, any case
    assert.equal((await listStudents({ name: "ann05 zephyrine" })).total, 1); // first + middle together
    assert.equal((await listStudents({ name: "teststu pg", status: "audit" })).total, 3);
    assert.equal((await listStudents({ name: "teststu pg", status: "full_time" })).total, 9);
    assert.equal((await listStudents({ name: "no-such-student-xyz" })).total, 0);
    const row = p1.students[0];
    assert.ok(!("photo" in row)); // the list never loads the picture
    assert.equal((await getStudent(row.id as number))?.has_photo, false);
    assert.equal(await getStudent(2147483000), null);
    const [withPic] = await sql`SELECT id FROM students WHERE last_name = 'TestStu Hopper'`;
    assert.equal((await getStudent(withPic.id as number))?.has_photo, true);

    console.log("all student checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("STUDENT CHECK FAILED:", e);
  process.exit(1);
});
