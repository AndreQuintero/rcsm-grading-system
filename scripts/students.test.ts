import assert from "node:assert/strict";
import { sql } from "../lib/db";
import { parseStudent, PHOTO_MAX_BYTES } from "../lib/student";
import { createStudent } from "../app/students/new/actions";

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
const base = { firstName: " Grace ", middleName: "", lastName: "TestStu Hopper", dateOfBirth: "1990-12-09", status: "inquiry" };
const cleanup = () => sql`DELETE FROM students WHERE last_name LIKE 'TestStu %'`;

(async () => {
  await cleanup();
  try {
    // validation
    const ok = parseStudent(fd(base));
    assert.deepEqual(ok.data, {
      firstName: "Grace", middleName: null, lastName: "TestStu Hopper", dateOfBirth: "1990-12-09",
      status: "inquiry", enrollmentDate: null, photo: null,
    });
    assert.ok(parseStudent(fd({ ...base, firstName: "" })).errors?.firstName);
    assert.ok(parseStudent(fd({ ...base, lastName: " " })).errors?.lastName);
    assert.ok(parseStudent(fd({ ...base, dateOfBirth: "2026-02-31" })).errors?.dateOfBirth);
    assert.ok(parseStudent(fd({ ...base, dateOfBirth: "2999-01-01" })).errors?.dateOfBirth);
    assert.ok(parseStudent(fd({ ...base, status: "" })).errors?.status);

    // enrollment date: required for audit and full time, optional for inquiry
    assert.ok(parseStudent(fd({ ...base, status: "audit" })).errors?.enrollmentDate);
    assert.ok(parseStudent(fd({ ...base, status: "full_time", enrollmentDate: "2026-13-01" })).errors?.enrollmentDate);
    assert.equal(parseStudent(fd({ ...base, status: "full_time", enrollmentDate: "2026-01-15" })).data?.enrollmentDate, "2026-01-15");
    // an enrollment date sent for an inquiry is dropped rather than stored
    assert.equal(parseStudent(fd({ ...base, enrollmentDate: "2026-01-15" })).data?.enrollmentDate, null);

    // photo: optional, typed and size-limited
    const pic = new File([PNG], "me.png", { type: "image/png" });
    assert.equal(parseStudent(fd(base, pic)).data?.photo?.type, "image/png");
    assert.equal(parseStudent(fd(base, new File([""], "", { type: "application/octet-stream" }))).data?.photo, null);
    assert.ok(parseStudent(fd(base, new File([PNG], "x.gif", { type: "image/gif" }))).errors?.photo);
    const big = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "big.png", { type: "image/png" });
    assert.ok(parseStudent(fd(base, big)).errors?.photo);

    // create: stores the photo bytes and the enrollment date
    assert.equal((await createStudent({}, fd({ ...base, status: "audit", enrollmentDate: "2026-02-01", middleName: "Brewster" }, pic))).message,
      "Registered Grace TestStu Hopper.");
    const [withPhoto] = await sql`SELECT middle_name, status, enrollment_date::text AS enrolled, photo_type,
      encode(photo, 'base64') AS b64 FROM students WHERE last_name = 'TestStu Hopper'`;
    assert.equal(withPhoto.middle_name, "Brewster");
    assert.equal(withPhoto.status, "audit");
    assert.equal(withPhoto.enrolled, "2026-02-01");
    assert.equal(withPhoto.photo_type, "image/png");
    assert.equal(Buffer.from(withPhoto.b64 as string, "base64").equals(PNG), true);

    // create without a photo
    await createStudent({}, fd({ ...base, firstName: "Ada", lastName: "TestStu Byron", status: "inquiry" }));
    const [noPhoto] = await sql`SELECT photo, enrollment_date FROM students WHERE last_name = 'TestStu Byron'`;
    assert.equal(noPhoto.photo, null);
    assert.equal(noPhoto.enrollment_date, null);

    // the database refuses an audit/full-time student without an enrollment date
    await assert.rejects(
      sql`INSERT INTO students (first_name, last_name, date_of_birth, status) VALUES ('X', 'TestStu Bad', '2000-01-01', 'full_time')`,
    );

    // validation errors come back with the typed values
    const bad = await createStudent({}, fd({ ...base, status: "audit" }));
    assert.equal(bad.values?.firstName, " Grace ");
    assert.ok(bad.errors?.enrollmentDate);

    console.log("all student checks passed");
  } finally {
    await cleanup();
  }
})().catch((e) => {
  console.error("STUDENT CHECK FAILED:", e);
  process.exit(1);
});
