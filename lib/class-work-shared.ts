import { isRealDate } from "@/lib/dates";

// Client-safe class work rules: weekly meetings and their marks (attendance status, assignments and participation 0–100).

export const CLASS_WORK_PAGE_SIZE = 10;
export const MEETING_NAME_MAX = 150;
export const MARK_MAX = 100;

export const ATTENDANCE = [
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "absent", label: "Absent" },
  { key: "excused", label: "Excused" },
] as const;
export type Attendance = (typeof ATTENDANCE)[number]["key"];
export const attendanceLabel = (a: string | null) => ATTENDANCE.find((x) => x.key === a)?.label ?? null;

export type Marks = { attendance: Attendance | null; assignments: number | null; participation: number | null };
export type MeetingInput = { name: string; heldOn: string };
export type MeetingFormState = { errors?: Record<string, string>; message?: string; values?: Record<string, string> };

export function parseMeeting(fd: FormData): { data?: MeetingInput; errors?: Record<string, string> } {
  const name = String(fd.get("name") ?? "").trim();
  const heldOn = String(fd.get("heldOn") ?? "").trim();
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter a name, e.g. Week #1.";
  else if (name.length > MEETING_NAME_MAX) errors.name = `Use at most ${MEETING_NAME_MAX} characters.`;
  if (!isRealDate(heldOn)) errors.heldOn = "Enter the date of the meeting.";
  return Object.keys(errors).length ? { errors } : { data: { name, heldOn } };
}

// The meeting's summary for one subject. Attendance % = (present + late) over present + late + absent: an excused
// student is left out. Score averages count only the students who have that score.
export function meetingSummary(marks: Marks[]) {
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const m of marks) if (m.attendance) counts[m.attendance]++;
  const counted = counts.present + counts.late + counts.absent;
  const avg = (k: "assignments" | "participation") => {
    const v = marks.map((m) => m[k]).filter((x): x is number => x !== null);
    return { avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length };
  };
  return {
    attendance: { counts, pct: counted ? Math.round(((counts.present + counts.late) / counted) * 100) : null, n: counted + counts.excused },
    assignments: avg("assignments"),
    participation: avg("participation"),
  };
}

const ATTENDANCE_KEYS: readonly string[] = ATTENDANCE.map((a) => a.key);

// Untrusted attendance form: `att-<studentId>` = present | late | absent | excused, or "" (not taken yet).
export function parseAttendance(fd: FormData): { data?: Map<number, Attendance | null>; error?: string } {
  const data = new Map<number, Attendance | null>();
  for (const [key, value] of fd.entries()) {
    const m = /^att-(\d+)$/.exec(key);
    if (!m) continue;
    const v = String(value);
    if (v !== "" && !ATTENDANCE_KEYS.includes(v)) return { error: "Choose Present, Late, Absent or Excused." };
    data.set(Number(m[1]), (v || null) as Attendance | null);
  }
  return { data };
}
