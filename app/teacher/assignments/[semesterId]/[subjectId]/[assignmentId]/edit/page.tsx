import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { periodLabel } from "@/lib/academic-semester";
import { assignmentMeetings, assignmentStudents, assignmentSubject, getAssignment, meetingLabel } from "@/lib/assignment";
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
  const [head, a, { students }, meetings] = await Promise.all([
    assignmentSubject(semesterId, subjectId),
    getAssignment(semesterId, subjectId, id),
    assignmentStudents(semesterId, subjectId),
    assignmentMeetings(teacherId, semesterId, subjectId),
  ]);
  if (!head || !a) notFound();
  // another teacher's meeting stays as it is; the teacher can only pick among their own
  const fixedMeeting = a.meeting && a.meetingTeacherId !== teacherId ? { id: a.meeting.id, label: meetingLabel(a.meeting, false) } : undefined;
  const initial: Record<string, string> = {
    meetingId: a.meeting ? String(a.meeting.id) : "", name: a.name, dueOn: a.dueOn, maxScore: String(a.maxScore),
    ...Object.fromEntries(Object.entries(a.scores).map(([sid, score]) => [`score-${sid}`, String(score)])),
    ...Object.fromEntries(Object.entries(a.comments).map(([sid, comment]) => [`comment-${sid}`, comment])),
  };

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit assignment"
        description={`${head.subject}, ${periodLabel(head.period)}`}
        action={<BackLink href={`/teacher/assignments/${semesterId}/${subjectId}`} label={`Back to ${head.subject} assignments`} />}
      />
      <AssignmentForm
        semesterId={semesterId}
        subjectId={subjectId}
        assignmentId={a.id}
        students={students}
        initial={initial}
        meetings={meetings.filter((m) => m.own).map((m) => ({ value: String(m.id), label: meetingLabel(m, true) }))}
        fixedMeeting={fixedMeeting}
      />
    </main>
  );
}
