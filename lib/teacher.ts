export type TeacherInput = {
  fullName: string;
  dateOfBirth: string;
  email: string;
  subjects: string[];
};

export type TeacherParse =
  | { data: TeacherInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined };

// Validates untrusted form input; the server action re-runs this, so the client is not trusted.
export function parseTeacher(formData: FormData): TeacherParse {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const subjects = [
    ...new Set(
      String(formData.get("subjects") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  const errors: Record<string, string> = {};
  const today = new Date().toISOString().slice(0, 10);
  if (!fullName) errors.fullName = "Full name is required.";
  // Date.parse rolls over impossible days (2026-02-31), so the round trip must match the input.
  const isRealDate = (s: string) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !isRealDate(dateOfBirth))
    errors.dateOfBirth = "Enter a valid date of birth.";
  else if (dateOfBirth > today) errors.dateOfBirth = "Date of birth cannot be in the future.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (subjects.length === 0) errors.subjects = "Add at least one subject, one per line.";

  if (Object.keys(errors).length) return { errors };
  return { data: { fullName, dateOfBirth, email, subjects } };
}
