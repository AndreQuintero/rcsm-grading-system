"use server";

import { revalidatePath } from "next/cache";
import { deleteMeeting, getMeeting, insertMeeting, meetingStudents, saveAttendance, saveParticipation, updateMeeting } from "@/lib/class-work";
import { parseAttendance, parseMeeting, parseParticipation, type MeetingFormState, type ParticipationState } from "@/lib/class-work-shared";
import { requireTeacher, teaches } from "@/lib/grading";

const id = (n: number) => Number.isInteger(n) && n > 0;
const echo = (fd: FormData) => ({ name: String(fd.get("name") ?? ""), heldOn: String(fd.get("heldOn") ?? "") });

// Every action: the signed-in teacher, and only their own meetings (any action can be posted to any path).
export async function createMeetingAction(semesterId: number, _prev: MeetingFormState, fd: FormData): Promise<MeetingFormState> {
  const { teacherId } = await requireTeacher();
  if (!id(semesterId)) throw new Error("Invalid semester id");
  const p = parseMeeting(fd);
  if (!p.data) return { errors: p.errors, values: echo(fd) };
  if ((await insertMeeting(teacherId, semesterId, p.data)) === null) return { errors: { form: "You don't teach in this semester." }, values: echo(fd) };
  return { message: `Registered ${p.data.name}.`, values: echo(fd) };
}

export async function updateMeetingAction(meetingId: number, _prev: MeetingFormState, fd: FormData): Promise<MeetingFormState> {
  const { teacherId } = await requireTeacher();
  if (!id(meetingId)) throw new Error("Invalid meeting id");
  const p = parseMeeting(fd);
  if (!p.data) return { errors: p.errors, values: echo(fd) };
  if (!(await updateMeeting(teacherId, meetingId, p.data))) return { errors: { form: "This weekly meeting no longer exists." }, values: echo(fd) };
  revalidatePath("/teacher/gradings/class-work", "layout");
  return { message: `Saved ${p.data.name}.`, values: echo(fd) };
}

export async function deleteMeetingAction(meetingId: number): Promise<void> {
  const { teacherId } = await requireTeacher();
  if (!id(meetingId)) throw new Error("Invalid meeting id");
  await deleteMeeting(teacherId, meetingId);
  revalidatePath("/teacher/gradings/class-work", "layout");
}

// Attendance of one meeting + subject: the teacher's own meeting, a subject they teach in its semester, and only the
// students the subject grades now are written.
export async function saveAttendanceAction(meetingId: number, subjectId: number, _prev: { error?: string; message?: string }, fd: FormData): Promise<{ error?: string; message?: string }> {
  const { teacherId } = await requireTeacher();
  if (!id(meetingId) || !id(subjectId)) throw new Error("Invalid id");
  const m = await getMeeting(teacherId, meetingId);
  if (!m || !(await teaches(m.semesterId, subjectId, teacherId))) throw new Error("Not your meeting or subject");
  const p = parseAttendance(fd);
  if (!p.data) return { error: p.error };
  const allowed = (await meetingStudents(m.id, m.semesterId, subjectId)).map((s) => s.id);
  await saveAttendance(m.id, subjectId, allowed, p.data);
  revalidatePath("/teacher/gradings/class-work", "layout");
  return { message: `Saved the attendance of ${m.name}.` };
}

// Participation scores + comments of one meeting + subject (same checks as the attendance).
export async function saveParticipationAction(meetingId: number, subjectId: number, _prev: ParticipationState, fd: FormData): Promise<ParticipationState> {
  const { teacherId } = await requireTeacher();
  if (!id(meetingId) || !id(subjectId)) throw new Error("Invalid id");
  const m = await getMeeting(teacherId, meetingId);
  if (!m || !(await teaches(m.semesterId, subjectId, teacherId))) throw new Error("Not your meeting or subject");
  const p = parseParticipation(fd);
  if (!p.data) return { errors: p.errors };
  const allowed = (await meetingStudents(m.id, m.semesterId, subjectId)).map((s) => s.id);
  await saveParticipation(m.id, subjectId, allowed, p.data);
  revalidatePath("/teacher/gradings/class-work", "layout");
  return { message: `Saved the participation of ${m.name}.` };
}
