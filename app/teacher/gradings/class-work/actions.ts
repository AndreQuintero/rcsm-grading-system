"use server";

import { revalidatePath } from "next/cache";
import { deleteMeeting, insertMeeting, updateMeeting } from "@/lib/class-work";
import { parseMeeting, type MeetingFormState } from "@/lib/class-work-shared";
import { requireTeacher } from "@/lib/grading";

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
