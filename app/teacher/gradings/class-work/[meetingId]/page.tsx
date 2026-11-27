import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { SemesterSelect } from "@/app/_dashboard/SemesterSelect";
import { BackLink } from "@/app/BackLink";
import { EmptyAnimation } from "@/components/empty-animation";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { AttendanceBadge, ClassWorkAverages } from "@/components/records/ClassWorkAverages";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel } from "@/lib/academic-semester";
import { getMeeting, meetingAssignmentCount, meetingStudents } from "@/lib/class-work";
import { formatDate } from "@/lib/dates";
import { requireTeacher, teacherSubjects } from "@/lib/grading";

type Params = { meetingId: string };
type SearchParams = { subject?: string };
const panel = "rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8";

export default function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true">
            <span role="status" className="sr-only">Loading</span>
            <Skeleton className="h-16 w-80 rounded-xl" />
            <Skeleton className="h-36 rounded-[1.75rem]" />
            <Skeleton className="h-64 rounded-[1.75rem]" />
          </div>
        }
      >
        <Summary params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// params, searchParams and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Summary({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const [{ teacherId }, p, sp] = await Promise.all([requireTeacher(), params, searchParams]);
  const id = Number(p.meetingId);
  const m = Number.isInteger(id) && id > 0 ? await getMeeting(teacherId, id) : null;
  if (!m) notFound();
  const subjects = await teacherSubjects(m.semesterId, teacherId);
  const subject = subjects.find((s) => String(s.id) === sp.subject) ?? subjects[0];
  const base = `/teacher/gradings/class-work/${m.id}`;
  const header = (
    <PageHeader
      title={m.name}
      description={`${formatDate(m.heldOn)} · ${periodLabel(m.period)}`}
      action={<BackLink href={`/teacher/gradings/class-work?semester=${m.semesterId}`} label="Back to class work" />}
    />
  );

  if (!subject)
    return (
      <>
        {header}
        <section aria-labelledby="no-subjects" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
          <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
          <h2 id="no-subjects" className="mt-2 font-heading text-2xl font-bold">You teach no subjects in this semester</h2>
          <p className="mt-2 max-w-md text-muted-foreground">An admin assigns the subjects you teach on the academic semester.</p>
        </section>
      </>
    );

  const [students, assignments] = await Promise.all([meetingStudents(m.id, m.semesterId, subject.id), meetingAssignmentCount(m.id, subject.id)]);

  return (
    <>
      {header}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 className="font-heading text-2xl font-bold">{subject.name}</h2>
            <p className="text-sm text-muted-foreground">Class work of {m.name}, {formatDate(m.heldOn)}.</p>
          </div>
        </div>
        <SemesterSelect
          kind="subject"
          pathTemplate={`${base}?subject={id}`}
          value={subject.id}
          choices={subjects.map((s) => ({ id: s.id, label: s.name, current: false }))}
        />
      </div>

      <ClassWorkAverages marks={students.map((s) => s.marks)} assignments={assignments} assignmentsHref={`/teacher/assignments/${m.semesterId}/${subject.id}?meeting=${m.id}`} attendanceHref={`${base}/attendance?subject=${subject.id}`} />

      <section aria-labelledby="students" className={panel}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="students" className="font-heading text-xl font-bold">Students</h2>
          <p className="text-sm text-muted-foreground">{students.length} student{students.length === 1 ? "" : "s"}. Select one to see their summary.</p>
        </div>
        {students.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <EmptyAnimation />
            {subject.batches ? "The assigned batches have no active students." : "This subject has no batch yet. An admin assigns batches on the academic semester."}
            {!subject.batches && (
              <div className="mt-4">
                <Button variant="outline" asChild><Link href={`/teacher/gradings/final?semester=${m.semesterId}`}>Go to Final gradings</Link></Button>
              </div>
            )}
          </div>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`${base}/students/${s.id}?subject=${subject.id}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 rounded-2xl px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40 lg:grid-cols-[auto_minmax(0,1fr)_6rem_6rem_6rem_auto]"
                >
                  <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-11" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{s.batch} <StatusBadge status={s.status} /></span>
                  </span>
                  <span className="hidden text-center lg:block">
                    <span className="block text-[0.7rem] text-muted-foreground">Attendance</span>
                    <AttendanceBadge value={s.marks.attendance} />
                  </span>
                  {(["assignments", "participation"] as const).map((k) => (
                    <span key={k} className="hidden text-center lg:block">
                      <span className="block text-[0.7rem] text-muted-foreground">{k === "assignments" ? "Assignments" : "Participation"}</span>
                      <span className="font-medium tabular-nums">{s.marks[k] === null ? "–" : k === "assignments" ? `${s.marks[k]}%` : s.marks[k]}</span>
                    </span>
                  ))}
                  <span className="flex items-center gap-2 lg:contents">
                    <span className="lg:hidden"><AttendanceBadge value={s.marks.attendance} /></span>
                    <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
