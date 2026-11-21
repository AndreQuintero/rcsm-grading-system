// Client-safe grading rules, shared by the grade form and the server.

export const GRADE_MAX = 25;
// Teacher home: students at or below this share of their possible points are listed as needing attention.
export const ATTENTION_MAX_PCT = 90;
export const COMMENT_MAX = 2000;
// `short` labels narrow column headers.
export const GRADE_TYPES = [
  { key: "attendance", label: "Attendance", short: "Attendance" },
  { key: "assignments", label: "Assignments and Activities", short: "Assignments" },
  { key: "participation", label: "Participation", short: "Participation" },
  { key: "exams", label: "Midterm & Final Exam", short: "Exams" },
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

// Class averages for a subject. Each type averages only the students who have that grade; the total averages
// the totals of students with at least one grade. `n` = how many students counted; avg is null when n = 0.
export function gradeAverages(list: Grades[]) {
  const avg = (xs: number[]) => ({ avg: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null, n: xs.length });
  const byType = Object.fromEntries(
    GRADE_TYPES.map((t) => [t.key, avg(list.map((g) => g[t.key]).filter((v): v is number => v !== null))]),
  ) as Record<GradeKey, { avg: number | null; n: number }>;
  return { ...byType, total: avg(list.map(gradeTotal).filter((t) => t.given > 0).map((t) => t.total)) };
}

// Bar chart data: one entry per subject name, averaging the totals of its graded semesters (rows with ≥ 1 grade).
export function subjectAverages(rows: { subject: string; grades: Grades }[]) {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    const t = gradeTotal(r.grades);
    if (t.given) by.set(r.subject, [...(by.get(r.subject) ?? []), t.total]);
  }
  return [...by].map(([subject, totals]) => ({
    subject,
    avg: Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10,
    semesters: totals.length,
  }));
}

// Gauge data: points earned out of the points possible for the grades given so far (25 per grade), so a subject that
// is only half graded doesn't count as half failed.
export function overallScore(rows: { grades: Grades }[]) {
  let earned = 0, given = 0;
  for (const r of rows) { const t = gradeTotal(r.grades); earned += t.total; given += t.given; }
  const possible = given * GRADE_MAX;
  return { earned, possible, pct: possible ? Math.round((earned / possible) * 100) : null };
}

type HomeStudent = { id: number; name: string; hasPhoto: boolean; grades: Grades };

// Teacher home: per subject, who is still missing grades (and which types); the class average per subject; and the
// up to 4 lowest scores so far at or below ATTENTION_MAX_PCT, ranked by % of the points possible for the grades given
// (same rule as the record gauge).
export function homeSummary(subjects: { subjectId: number; subject: string; students: HomeStudent[] }[]) {
  const missing = subjects
    .map((s) => {
      const byType = Object.fromEntries(GRADE_TYPES.map((t) => [t.key, s.students.filter((x) => x.grades[t.key] === null).length])) as Record<GradeKey, number>;
      return { subjectId: s.subjectId, subject: s.subject, students: s.students.filter((x) => gradeTotal(x.grades).given < 4).length, byType };
    })
    .filter((m) => m.students > 0);
  const averages = subjectAverages(subjects.flatMap((s) => s.students.map((x) => ({ subject: s.subject, grades: x.grades }))));
  const lowest = subjects
    .flatMap((s) => s.students.map((x) => ({ ...x, subjectId: s.subjectId, subject: s.subject, ...gradeTotal(x.grades) })))
    .filter((x) => x.given > 0)
    .map((x) => ({ id: x.id, name: x.name, hasPhoto: x.hasPhoto, subjectId: x.subjectId, subject: x.subject, total: x.total, possible: x.given * GRADE_MAX, pct: Math.round((x.total / (x.given * GRADE_MAX)) * 100) }))
    .filter((x) => x.pct <= ATTENTION_MAX_PCT)
    .sort((a, b) => a.pct - b.pct || a.total - b.total)
    .slice(0, 4);
  return { missing, averages, lowest };
}
