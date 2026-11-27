// Client-safe assignment rules, shared by the assignment form and the server.
import { isRealDate } from "@/lib/dates";

export const ASSIGNMENT_PAGE_SIZE = 10;
export const ASSIGNMENT_NAME_MAX = 150;
export const ASSIGNMENT_MAX_SCORE = 1000;

export type AssignmentFormState = { errors?: Record<string, string>; message?: string; values?: Record<string, string> };
export type AssignmentInput = { meetingId: number; name: string; dueOn: string; maxScore: number; scores: Map<number, number | null> };

const whole = (raw: string, max: number) => (/^\d+$/.test(raw) && Number(raw) <= max ? Number(raw) : null);

// Validates untrusted form input: weekly meeting, name, date and maximum points are required; each `score-<studentId>` is blank
// (not scored yet) or a whole number from 0 to the maximum.
export function parseAssignment(formData: FormData):
  | { data: AssignmentInput; errors?: undefined }
  | { errors: Record<string, string>; data?: undefined } {
  const errors: Record<string, string> = {};
  const rawMeeting = String(formData.get("meetingId") ?? "").trim();
  const meetingId = /^\d+$/.test(rawMeeting) && Number(rawMeeting) > 0 ? Number(rawMeeting) : null;
  if (!meetingId) errors.meetingId = "Choose the weekly meeting of this assignment.";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) errors.name = "Enter a name for the assignment.";
  else if (name.length > ASSIGNMENT_NAME_MAX) errors.name = `Use at most ${ASSIGNMENT_NAME_MAX} characters.`;

  const dueOn = String(formData.get("dueOn") ?? "").trim();
  if (!dueOn) errors.dueOn = "Choose the date of the assignment.";
  else if (!isRealDate(dueOn) || dueOn < "2000-01-01" || dueOn > "2100-12-31") errors.dueOn = "Enter a real date between 2000 and 2100.";

  const rawMax = String(formData.get("maxScore") ?? "").trim();
  const maxScore = whole(rawMax, ASSIGNMENT_MAX_SCORE);
  if (!rawMax) errors.maxScore = "Enter the maximum points.";
  else if (!maxScore) errors.maxScore = `Enter a whole number from 1 to ${ASSIGNMENT_MAX_SCORE}.`;

  const scores = new Map<number, number | null>();
  for (const [key, value] of formData.entries()) {
    const m = /^score-(\d+)$/.exec(key);
    if (!m) continue;
    const raw = String(value).trim();
    if (raw === "") scores.set(Number(m[1]), null);
    else if (maxScore && whole(raw, maxScore) !== null) scores.set(Number(m[1]), Number(raw));
    // without a valid maximum, a score can't be checked: the maximum's own error says what to fix
    else if (maxScore) errors[key] = `Enter a whole number from 0 to ${maxScore}, or leave it empty.`;
  }

  if (Object.keys(errors).length) return { errors };
  return { data: { meetingId: meetingId!, name, dueOn, maxScore: maxScore!, scores } };
}

// Class average of the scores given (null when none), rounded to one decimal.
export function scoreAverage(scores: (number | null)[]) {
  const given = scores.filter((s): s is number => s !== null);
  return { avg: given.length ? Math.round((given.reduce((a, b) => a + b, 0) / given.length) * 10) / 10 : null, n: given.length };
}
