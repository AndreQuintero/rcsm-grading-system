"use server";

import { revalidatePath } from "next/cache";
import { assignmentStudents, deleteAssignment, saveAssignment, scoresAbove } from "@/lib/assignment";
import { parseAssignment, type AssignmentFormState } from "@/lib/assignment-shared";
import { requireTeacher, teaches } from "@/lib/grading";

const ids = (...n: number[]) => n.every((x) => Number.isInteger(x) && x > 0);

// Every action: a teacher who teaches this subject in this semester (any action can be posted to any path).
async function allowed(semesterId: number, subjectId: number) {
  const t = await requireTeacher();
  if (!ids(semesterId, subjectId) || !(await teaches(semesterId, subjectId, t.teacherId))) throw new Error("Not your subject");
  return t;
}

// The typed values, so the form keeps them after an error.
const echo = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([k]) => k === "name" || k === "dueOn" || k === "maxScore" || k.startsWith("score-")).map(([k, v]) => [k, String(v)]));

async function save(semesterId: number, subjectId: number, id: number | null, fd: FormData): Promise<AssignmentFormState> {
  const { userId } = await allowed(semesterId, subjectId);
  const values = echo(fd);
  const parsed = parseAssignment(fd);
  if (!parsed.data) return { errors: parsed.errors, values };
  const { students, batches } = await assignmentStudents(semesterId, subjectId);
  // a new assignment needs students to score; an existing one can still be renamed after its batches were removed
  if (!batches && id === null) return { errors: { form: "Add a batch to this subject in Gradings before registering assignments." }, values };
  const listed = students.map((s) => s.id);
  if (id !== null && (await scoresAbove(id, parsed.data.maxScore, listed)))
    return { errors: { maxScore: "Some students no longer in the list have a score above this maximum. Use a higher maximum." }, values };
  const saved = await saveAssignment(semesterId, subjectId, id, userId, parsed.data, listed);
  if (saved === null) return { errors: { form: "This assignment no longer exists." }, values };
  revalidatePath("/teacher/assignments", "layout");
  return { message: id === null ? `Registered ${parsed.data.name}.` : `Saved ${parsed.data.name}.`, values };
}

export async function createAssignmentAction(semesterId: number, subjectId: number, _prev: AssignmentFormState, fd: FormData) {
  return save(semesterId, subjectId, null, fd);
}

export async function updateAssignmentAction(semesterId: number, subjectId: number, id: number, _prev: AssignmentFormState, fd: FormData) {
  if (!ids(id)) throw new Error("Invalid assignment id");
  return save(semesterId, subjectId, id, fd);
}

export async function deleteAssignmentAction(semesterId: number, subjectId: number, id: number): Promise<void> {
  await allowed(semesterId, subjectId);
  if (!ids(id)) throw new Error("Invalid assignment id");
  await deleteAssignment(semesterId, subjectId, id);
  revalidatePath("/teacher/assignments", "layout");
}
