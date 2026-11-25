"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher, saveGrades, teaches } from "@/lib/grading";
import { GRADE_TYPES, parseGrades, type GradeFormState } from "@/lib/grading-shared";

const ids = (...n: number[]) => n.every((x) => Number.isInteger(x) && x > 0);

// Every action: a teacher who teaches this subject in this semester (any of them; the data is shared).
async function allowed(semesterId: number, subjectId: number) {
  const t = await requireTeacher();
  if (!ids(semesterId, subjectId) || !(await teaches(semesterId, subjectId, t.teacherId))) throw new Error("Forbidden");
  return t;
}

export async function saveGradesAction(semesterId: number, subjectId: number, studentId: number, _prev: GradeFormState, formData: FormData): Promise<GradeFormState> {
  const t = await allowed(semesterId, subjectId);
  if (!ids(studentId)) throw new Error("Invalid student id");
  const values = Object.fromEntries([...GRADE_TYPES.map((t) => t.key), "comment"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = parseGrades(formData);
  if (!parsed.data) return { errors: parsed.errors, values };
  if (!(await saveGrades(semesterId, subjectId, studentId, t.userId, parsed.data)))
    return { errors: { form: "This student is no longer graded in this subject (their batch was removed, or they became inactive)." }, values };
  revalidatePath(`/teacher/gradings`, "layout");
  return { message: "Grades saved.", values };
}
