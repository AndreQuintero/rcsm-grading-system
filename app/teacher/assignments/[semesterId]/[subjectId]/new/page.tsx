import { Layers } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { periodLabel } from "@/lib/academic-semester";
import { assignmentStudents, assignmentSubject } from "@/lib/assignment";
import { todayIso } from "@/lib/dates";
import { requireTeacher, teaches } from "@/lib/grading";
import { AssignmentForm } from "./AssignmentForm";

type Params = { semesterId: string; subjectId: string };

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Assignment name", "Date", "Maximum points"]} /></main>}>
      <Register params={params} />
    </Suspense>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Register({ params }: { params: Promise<Params> }) {
  const [{ teacherId }, p] = await Promise.all([requireTeacher(), params]);
  const semesterId = Number(p.semesterId), subjectId = Number(p.subjectId);
  if (!Number.isInteger(semesterId) || !Number.isInteger(subjectId) || !(await teaches(semesterId, subjectId, teacherId))) notFound();
  const [head, { batches, students }] = await Promise.all([assignmentSubject(semesterId, subjectId), assignmentStudents(semesterId, subjectId)]);
  if (!head) notFound();
  const list = `/teacher/assignments/${semesterId}/${subjectId}`;

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title="Register assignment"
        description={`${head.subject}, ${periodLabel(head.period)}`}
        action={<BackLink href={list} label={`Back to ${head.subject} assignments`} />}
      />
      {batches === 0 ? (
        <NoBatch semesterId={semesterId} subjectId={subjectId} subject={head.subject} />
      ) : (
        <AssignmentForm semesterId={semesterId} subjectId={subjectId} students={students} initial={{ dueOn: todayIso() }} />
      )}
    </main>
  );
}

// Assignments score the students of the subject's batches, so a subject with no batch can't have one yet.
function NoBatch({ semesterId, subjectId, subject }: { semesterId: number; subjectId: number; subject: string }) {
  return (
    <section aria-labelledby="no-batch" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-amber-500/12 text-amber-700">
        <Layers className="size-8" aria-hidden="true" />
      </span>
      <h2 id="no-batch" className="mt-5 font-heading text-2xl font-bold">Add a batch to {subject} first</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Assignments score the students of the batches added to this subject in this semester. Add a batch in Gradings,
        then come back to register the assignment.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href={`/teacher/gradings/${semesterId}/${subjectId}`}>
          <Layers aria-hidden="true" />
          Add a batch in Gradings
        </Link>
      </Button>
    </section>
  );
}
