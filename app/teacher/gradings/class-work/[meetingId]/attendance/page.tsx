import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { EmptyAnimation } from "@/components/empty-animation";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { periodLabel } from "@/lib/academic-semester";
import { getMeeting, meetingStudents } from "@/lib/class-work";
import { formatDate } from "@/lib/dates";
import { requireTeacher, teaches } from "@/lib/grading";
import { getSubject } from "@/lib/subject";
import { AttendanceForm } from "./AttendanceForm";

type Params = { meetingId: string };

export default function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ subject?: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl"><HeaderSkeleton /><FormSkeleton fields={["Students"]} /></main>}>
      <Attendance params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// params, searchParams and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Attendance({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ subject?: string }> }) {
  const [{ teacherId }, p, sp] = await Promise.all([requireTeacher(), params, searchParams]);
  const [meetingId, subjectId] = [p.meetingId, sp.subject ?? ""].map(Number);
  if (![meetingId, subjectId].every((n) => Number.isInteger(n) && n > 0)) notFound();
  const m = await getMeeting(teacherId, meetingId);
  if (!m || !(await teaches(m.semesterId, subjectId, teacherId))) notFound();
  const [students, subject] = await Promise.all([meetingStudents(m.id, m.semesterId, subjectId), getSubject(subjectId)]);
  if (!subject) notFound();
  const back = `/teacher/gradings/class-work/${m.id}?subject=${subjectId}`;

  return (
    <main className="mx-auto max-w-4xl">
      <PageHeader
        title="Attendance"
        description={`${subject.name as string} · ${m.name}, ${formatDate(m.heldOn)} · ${periodLabel(m.period)}`}
        action={<BackLink href={back} label={`Back to ${m.name}`} />}
      />
      {students.length === 0 ? (
        <section className="rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center text-muted-foreground">
          <EmptyAnimation />
          No students to take attendance for: an admin hasn&apos;t assigned a batch to this subject yet, or its batches have no active students.
        </section>
      ) : (
        <AttendanceForm
          meetingId={m.id}
          subjectId={subjectId}
          back={back}
          students={students.map((s) => ({ id: s.id, name: s.name, hasPhoto: s.hasPhoto, batch: s.batch, attendance: s.marks.attendance }))}
        />
      )}
    </main>
  );
}
