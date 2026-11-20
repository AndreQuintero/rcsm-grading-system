// Client-safe grading rules, shared by the grade form and the server.

export const GRADE_MAX = 25;
export const COMMENT_MAX = 2000;
export const GRADE_TYPES = [
  { key: "midterm", label: "Midterm exam" },
  { key: "participation", label: "Participation" },
  { key: "presence", label: "Presence" },
  { key: "final_exam", label: "Final exam" },
] as const;
export type GradeKey = (typeof GRADE_TYPES)[number]["key"];
export type Grades = Record<GradeKey, number | null>;
export type GradeFormState = { errors?: Record<string, string>; message?: string; values?: Record<string, string> };

// The total is the sum of the grades given so far (each out of 25, so out of 100); `given` says how many of the 4.
export function gradeTotal(g: Partial<Grades>) {
  const given = GRADE_TYPES.map((t) => g[t.key]).filter((v): v is number => v !== null && v !== undefined);
  return { total: given.reduce((a, b) => a + b, 0), given: given.length };
}

// Blank = not given yet; otherwise a whole number from 0 to 25. Validates untrusted form input.
export function parseGrades(formData: FormData):
  | { data: Grades & { comment: string | null }; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined } {
  const errors: Record<string, string> = {};
  const data = { comment: null } as Grades & { comment: string | null };
  for (const t of GRADE_TYPES) {
    const raw = String(formData.get(t.key) ?? "").trim();
    if (raw === "") data[t.key] = null;
    else if (/^\d+$/.test(raw) && Number(raw) <= GRADE_MAX) data[t.key] = Number(raw);
    else errors[t.key] = `Enter a whole number from 0 to ${GRADE_MAX}, or leave it empty.`;
  }
  const comment = String(formData.get("comment") ?? "").trim();
  if (comment.length > COMMENT_MAX) errors.comment = `Use at most ${COMMENT_MAX} characters.`;
  data.comment = comment || null;
  if (Object.keys(errors).length) return { errors };
  return { data };
}
