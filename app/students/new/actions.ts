"use server";

import { sql } from "@/lib/db";
import { parseStudent } from "@/lib/student";

export type StudentFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

export async function createStudent(_prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const parsed = parseStudent(formData);
  if (!parsed.data) {
    // text fields only; the file input cannot be re-filled after an error
    const values = Object.fromEntries(
      ["firstName", "middleName", "lastName", "dateOfBirth", "status", "enrollmentDate"].map((k) => [k, String(formData.get(k) ?? "")]),
    );
    return { errors: parsed.errors, values };
  }

  const { firstName, middleName, lastName, dateOfBirth, status, enrollmentDate, photo } = parsed.data;
  const photoB64 = photo ? Buffer.from(await photo.arrayBuffer()).toString("base64") : null;
  await sql`INSERT INTO students (first_name, middle_name, last_name, date_of_birth, status, enrollment_date, photo, photo_type)
    VALUES (${firstName}, ${middleName}, ${lastName}, ${dateOfBirth}, ${status}, ${enrollmentDate},
      decode(${photoB64}::text, 'base64'), ${photo?.type ?? null})`;
  return { message: `Registered ${firstName} ${lastName}.` };
}
