import { isRealDate, todayIso } from "@/lib/dates";
import { parsePhoto, PHOTO_MAX_BYTES } from "@/lib/photo";

export { PHOTO_MAX_BYTES };

export const STATUSES = {
  audit: "Audit",
  full_time: "Full time",
  inactive: "Inactive",
} as const;
export type Status = keyof typeof STATUSES;

export type StudentInput = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  dateOfBirth: string;
  status: Status;
  enrollmentDate: string;
  photo: File | null;
};

export type StudentParse =
  | { data: StudentInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined };

// Validates untrusted form input; the server action re-runs this, so the client is not trusted.
export function parseStudent(formData: FormData): StudentParse {
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const firstName = text("firstName");
  const middleName = text("middleName") || null;
  const lastName = text("lastName");
  const email = text("email").toLowerCase();
  const dateOfBirth = text("dateOfBirth");
  const status = text("status");
  const enrollmentDate = text("enrollmentDate");
  const { photo, error: photoError } = parsePhoto(formData);

  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "First name is required.";
  if (!lastName) errors.lastName = "Last name is required.";
  if (!email) errors.email = "Email is required.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!isRealDate(dateOfBirth)) errors.dateOfBirth = "Enter a valid date of birth.";
  else if (dateOfBirth > todayIso()) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (!(status in STATUSES)) errors.status = "Choose a status.";
  if (!enrollmentDate) errors.enrollmentDate = "Enrollment date is required.";
  else if (!isRealDate(enrollmentDate)) errors.enrollmentDate = "Enter a valid enrollment date.";
  if (photoError) errors.photo = photoError;

  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      firstName,
      middleName,
      lastName,
      email,
      dateOfBirth,
      status: status as Status,
      enrollmentDate,
      photo,
    },
  };
}

// Raw text fields, used to re-fill the form after a validation error (a file input cannot be re-filled).
export function studentValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    ["firstName", "middleName", "lastName", "email", "dateOfBirth", "status", "enrollmentDate"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
}

// Maps Postgres errors the user can fix to form errors; anything else is rethrown.
export function studentDbError(e: unknown): Record<string, string> {
  if ((e as { code?: string }).code === "23505") return { email: "A student with this email is already registered." };
  throw e;
}
