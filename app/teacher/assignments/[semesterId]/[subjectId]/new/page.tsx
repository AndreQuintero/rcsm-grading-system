import { ArrowLeft, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { periodLabel } from "@/lib/academic-semester";
import { assignmentMeetings, assignmentStudents, assignmentSubject, meetingLabel } from "@/lib/assignment";
import { todayIso } from "@/lib/dates";
import { requireTeacher, teaches } from "@/lib/grading";
import { AssignmentForm } from "./AssignmentForm";

type Params = { semesterId: string; subjectId: string };

type SearchParams = { meeting?: string };

export default function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Assignment name", "Date", "Maximum points"]} /></main>}>
      <Register params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Register({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const [{ teacherId }, p, sp] = await Promise.all([requireTeacher(), params, searchParams]);
  const semesterId = Number(p.semesterId), subjectId = Number(p.subjectId);
  if (!Number.isInteger(semesterId) || !Number.isInteger(subjectId) || !(await teaches(semesterId, subjectId, teacherId))) notFound();
  const [head, { batches, students }, meetings] = await Promise.all([
    assignmentSubject(semesterId, subjectId), assignmentStudents(semesterId, subjectId), assignmentMeetings(teacherId, semesterId, subjectId),
  ]);
  if (!head) notFound();
  const own = meetings.filter((m) => m.own);
  // opened from a weekly meeting (or a list filtered to one): that meeting is fixed and a save goes back there; from the
  // Assignments menu the teacher picks the meeting
  const picked = own.find((m) => String(m.id) === sp.meeting);
  const list = `/teacher/assignments/${semesterId}/${subjectId}${picked ? `?meeting=${picked.id}` : ""}`;

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title="Register assignment"
        description={`${head.subject}, ${periodLabel(head.period)}`}
        action={<BackLink href={list} label={`Back to ${head.subject} assignments`} />}
      />
      {batches === 0 ? (
        <NoBatch list={list} subject={head.subject} />
      ) : own.length === 0 ? (
        <NoMeeting semesterId={semesterId} subject={head.subject} period={periodLabel(head.period)} />
      ) : (
        <AssignmentForm
          semesterId={semesterId}
          subjectId={subjectId}
          students={students}
          meetings={own.map((m) => ({ value: String(m.id), label: meetingLabel(m, true) }))}
          fixedMeeting={picked && { id: picked.id, label: meetingLabel(picked, true), note: "This assignment belongs to the weekly meeting you came from." }}
          initial={{ dueOn: picked?.heldOn ?? todayIso(), meetingId: picked ? String(picked.id) : "" }}
          returnTo={list}
        />
      )}
    </main>
  );
}

// Assignments score the students of the subject's batches, so a subject with no batch can't have one yet.
function NoBatch({ list, subject }: { list: string; subject: string }) {
  return (
    <section aria-labelledby="no-batch" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-12 text-center">
      <LottiePlayer name="business-plan" className="-mt-8 -mb-4 size-56" />
      <h2 id="no-batch" className="mt-2 font-heading text-2xl font-bold">{subject} has no batch yet</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Assignments score the students of the batches assigned to this subject in this semester. Once an admin assigns
        a batch to it, come back to register the assignment.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href={list}>
          <ArrowLeft aria-hidden="true" />
          Back to assignments
        </Link>
      </Button>
    </section>
  );
}

// Every assignment belongs to one of the teacher's weekly meetings, so they need one in this semester first.
function NoMeeting({ semesterId, subject, period }: { semesterId: number; subject: string; period: string }) {
  return (
    <section aria-labelledby="no-meeting" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-12 text-center">
      <LottiePlayer name="calendar-booking" className="-mt-4 size-56" />
      <h2 id="no-meeting" className="mt-2 font-heading text-2xl font-bold">Register a weekly meeting first</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Every assignment of {subject} belongs to one of your weekly meetings. You have none in {period} yet: register one
        in Class work, then come back to register the assignment.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href={`/teacher/gradings/class-work?semester=${semesterId}`}>
          <CalendarPlus aria-hidden="true" />
          Go to weekly meetings
        </Link>
      </Button>
    </section>
  );
}
