import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { AttendanceBadge } from "@/components/records/ClassWorkAverages";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel } from "@/lib/academic-semester";
import { getMeeting, meetingStudents } from "@/lib/class-work";
import { formatDate } from "@/lib/dates";
import { requireTeacher, teaches } from "@/lib/grading";
import { getSubject } from "@/lib/subject";

type Params = { meetingId: string; studentId: string };

export default function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ subject?: string }> }) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6">
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-16 w-80 rounded-xl" /><Skeleton className="h-56 rounded-[1.75rem]" /></div>}>
        <Student params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// One student's class work in this weekly meeting and subject. Entering the marks comes in a later step.
async function Student({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ subject?: string }> }) {
  const [{ teacherId }, p, sp] = await Promise.all([requireTeacher(), params, searchParams]);
  const [meetingId, studentId, subjectId] = [p.meetingId, p.studentId, sp.subject ?? ""].map(Number);
  if (![meetingId, studentId, subjectId].every((n) => Number.isInteger(n) && n > 0)) notFound();
  const m = await getMeeting(teacherId, meetingId);
  if (!m || !(await teaches(m.semesterId, subjectId, teacherId))) notFound();
  const [[s], sub] = await Promise.all([meetingStudents(m.id, m.semesterId, subjectId, studentId), getSubject(subjectId)]);
  if (!s || !sub) notFound();
  const subject = sub.name as string;

  return (
    <>
      <PageHeader
        title={s.name}
        description={`${subject} · ${m.name}, ${formatDate(m.heldOn)} · ${periodLabel(m.period)}`}
        action={<BackLink href={`/teacher/gradings/class-work/${m.id}?subject=${subjectId}`} label={`Back to ${m.name}`} />}
      />
      <section aria-labelledby="student" className="rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-20 ring-4 ring-accent" />
          <div className="min-w-0">
            <h2 id="student" className="font-heading text-2xl font-bold leading-tight">{s.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{s.batch} <StatusBadge status={s.status} /></p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border/70 pt-6 sm:grid-cols-3">
          <div><dt className="text-sm text-muted-foreground">Attendance</dt><dd className="mt-1"><AttendanceBadge value={s.marks.attendance} /></dd></div>
          <div><dt className="text-sm text-muted-foreground">Assignments</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{s.marks.assignments ?? "–"}<span className="text-sm font-medium text-muted-foreground"> / 100</span></dd></div>
          <div><dt className="text-sm text-muted-foreground">Participation</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{s.marks.participation ?? "–"}<span className="text-sm font-medium text-muted-foreground"> / 100</span></dd></div>
        </dl>
        <p className="mt-6 text-sm text-muted-foreground">Entering this student&apos;s weekly grades comes in the next step.</p>
      </section>
    </>
  );
}
