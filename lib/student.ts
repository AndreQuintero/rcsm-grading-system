import { isRealDate, todayIso } from "@/lib/dates";

export const STATUSES = {
  audit: "Audit",
  full_time: "Full time",
  inquiry: "Inquiry (not enrolled yet)",
} as const;
export type Status = keyof typeof STATUSES;

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const needsEnrollmentDate = (status: string) => status === "audit" || status === "full_time";

export type StudentInput = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  status: Status;
  enrollmentDate: string | null;
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
  const dateOfBirth = text("dateOfBirth");
  const status = text("status");
  const enrollmentDate = text("enrollmentDate") || null;
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "First name is required.";
  if (!lastName) errors.lastName = "Last name is required.";
  if (!isRealDate(dateOfBirth)) errors.dateOfBirth = "Enter a valid date of birth.";
  else if (dateOfBirth > todayIso()) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (!(status in STATUSES)) errors.status = "Choose a status.";
  if (needsEnrollmentDate(status)) {
    if (!enrollmentDate) errors.enrollmentDate = "Enrollment date is required for audit and full-time students.";
    else if (!isRealDate(enrollmentDate)) errors.enrollmentDate = "Enter a valid enrollment date.";
  }
  if (hasPhoto) {
    if (!PHOTO_TYPES.includes(photo.type)) errors.photo = "The photo must be a JPEG, PNG or WebP image.";
    else if (photo.size > PHOTO_MAX_BYTES) errors.photo = "The photo must be 2 MB or smaller.";
  }

  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      status: status as Status,
      enrollmentDate: needsEnrollmentDate(status) ? enrollmentDate : null,
      photo: hasPhoto ? photo : null,
    },
  };
}

// Raw text fields, used to re-fill the form after a validation error (a file input cannot be re-filled).
export function studentValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    ["firstName", "middleName", "lastName", "dateOfBirth", "status", "enrollmentDate"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
}
