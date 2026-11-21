import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { periodLabel } from "@/lib/academic-semester";
import { assignmentStudents, assignmentSubject, getAssignment } from "@/lib/assignment";
import { requireTeacher, teaches } from "@/lib/grading";
import { AssignmentForm } from "../../new/AssignmentForm";

type Params = { semesterId: string; subjectId: string; assignmentId: string };

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Assignment name", "Date", "Maximum points"]} /></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Edit({ params }: { params: Promise<Params> }) {
  const [{ teacherId }, p] = await Promise.all([requireTeacher(), params]);
  const [semesterId, subjectId, id] = [p.semesterId, p.subjectId, p.assignmentId].map(Number);
  if (![semesterId, subjectId, id].every(Number.isInteger) || !(await teaches(semesterId, subjectId, teacherId))) notFound();
  const [head, a, { students }] = await Promise.all([
    assignmentSubject(semesterId, subjectId),
    getAssignment(semesterId, subjectId, id),
    assignmentStudents(semesterId, subjectId),
  ]);
  if (!head || !a) notFound();
  const initial: Record<string, string> = {
    name: a.name, dueOn: a.dueOn, maxScore: String(a.maxScore),
    ...Object.fromEntries(Object.entries(a.scores).map(([sid, score]) => [`score-${sid}`, String(score)])),
  };

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit assignment"
        description={`${head.subject}, ${periodLabel(head.period)}`}
        action={<BackLink href={`/teacher/assignments/${semesterId}/${subjectId}`} label={`Back to ${head.subject} assignments`} />}
      />
      <AssignmentForm semesterId={semesterId} subjectId={subjectId} assignmentId={a.id} students={students} initial={initial} />
    </main>
  );
}
