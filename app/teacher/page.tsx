import { BookOpen, CheckCircle2, ChevronRight, ClipboardCheck, Layers, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { SemesterSelect } from "@/app/_dashboard/SemesterSelect";
import { LottiePlayer } from "@/components/lottie-player";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel } from "@/lib/academic-semester";
import { batchPeriod } from "@/lib/batch";
import { periodKey, pickDefault } from "@/lib/dashboard";
import { formatDate, todayIso } from "@/lib/dates";
import { requireTeacher, subjectGrading, teacherSemesters, teacherSubjects } from "@/lib/grading";
import { ATTENTION_MAX_PCT, GRADE_TYPES, homeSummary } from "@/lib/grading-shared";
import { cn } from "@/lib/utils";
import { ScoreBars } from "@/components/records/ScoreBars";

type SearchParams = { semester?: string };
const panel = "rounded-[1.75rem] border border-border/70 bg-card";
const link = "font-medium text-primary underline-offset-4 hover:underline";

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main className="flex flex-col gap-8" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-72 rounded-[1.75rem]" /><Skeleton className="h-48 rounded-[1.75rem]" /></main>}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

// The session and searchParams are request-time data, so they sit under Suspense (cacheComponents).
async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ teacherId, name }, sp] = await Promise.all([requireTeacher(), searchParams]);
  const choices = await teacherSemesters(teacherId);
  const selected = choices.find((c) => String(c.id) === sp.semester) ?? pickDefault(choices);
  const firstName = name.split(" ")[0];
  const welcome = (
    <div>
      <h1 className="font-heading text-2xl font-bold sm:text-3xl">Welcome back, {firstName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{formatDate(todayIso())}</p>
    </div>
  );

  if (!selected)
    return (
      <main className="flex flex-col gap-8">
        {welcome}
        <section aria-labelledby="no-semester" className={cn(panel, "flex flex-col items-center px-6 py-10 text-center")}>
          <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
          <h2 id="no-semester" className="mt-2 font-heading text-2xl font-bold">No semester assigned to you yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">Once an admin adds you to an academic semester with the subjects you teach, your overview shows up here.</p>
        </section>
      </main>
    );

  const subjects = await teacherSubjects(selected.id, teacherId);
  const pages = await Promise.all(subjects.map((s) => subjectGrading(selected.id, s.id)));
  const summary = homeSummary(subjects.map((s, i) => ({ subjectId: s.id, subject: s.name, students: pages[i]?.students ?? [] })));
  const batches = new Set(pages.flatMap((p) => p?.batches.filter((b) => b.bound).map((b) => b.id) ?? [])).size;
  const students = new Set(pages.flatMap((p) => p?.students.map((s) => s.id) ?? [])).size;
  const slots = subjects.reduce((n, s) => n + s.students, 0);
  const complete = subjects.reduce((n, s) => n + s.complete, 0);
  const pct = slots ? Math.round((complete / slots) * 100) : 0;
  const nowKey = periodKey(batchPeriod(todayIso()));
  const unbound = subjects.filter((s) => s.batches === 0);
  const base = `/teacher/gradings/${selected.id}`;
  const stats: { label: string; value: string; note?: string; icon: LucideIcon; tint: string }[] = [
    { label: "Subjects", value: String(subjects.length), icon: BookOpen, tint: "bg-primary/10 text-primary" },
    { label: "Batches assigned", value: String(batches), icon: Layers, tint: "bg-amber-500/12 text-amber-700" },
    { label: "Students", value: String(students), icon: Users, tint: "bg-sidebar/8 text-sidebar" },
    { label: "Fully graded", value: `${pct}%`, note: `${complete} of ${slots}`, icon: ClipboardCheck, tint: "bg-success/12 text-success" },
  ];

  return (
    <main className="flex flex-col gap-8">
      <section aria-labelledby="welcome" className={cn(panel, "overflow-hidden")}>
        <div className="grid items-center gap-6 px-6 pt-8 pb-6 sm:px-10 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div id="welcome">{welcome}</div>
              <SemesterSelect basePath="/teacher" value={selected.id} choices={choices.map((c) => ({ id: c.id, label: periodLabel(c), current: periodKey(c) === nowKey }))} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your semester</p>
              <p className="font-heading text-4xl font-bold sm:text-5xl">{periodLabel(selected)}</p>
            </div>
          </div>
          <LottiePlayer name="employee-content" className="hidden size-56 md:block" />
        </div>
        <dl className="grid grid-cols-2 border-t border-border/70 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("border-border/70", i % 2 === 0 && "border-r", i === 1 && "lg:border-r", i < 2 && "border-b lg:border-b-0")}>
              <Link href={`/teacher/gradings?semester=${selected.id}`} className="flex h-full flex-col gap-3 px-6 py-6 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset sm:px-8">
                <dt className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <span className={cn("grid size-8 place-items-center rounded-lg", s.tint)}><s.icon className="size-4" aria-hidden="true" /></span>
                  {s.label}
                </dt>
                <dd className="font-heading text-4xl font-bold tabular-nums">{s.value}</dd>
                {s.note && <dd className="-mt-2 text-sm text-muted-foreground">{s.note} across your subjects</dd>}
              </Link>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="progress" className={cn(panel, "p-6 sm:p-8")}>
          <h2 id="progress" className="font-heading text-xl font-bold">Grading progress</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">Students with all 4 grades, by subject.</p>
          <ul className="flex flex-col gap-1">
            {subjects.map((s) => (
              <li key={s.id}>
                <Link href={`${base}/${s.id}`} className="group flex items-center gap-4 rounded-2xl p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {s.batches ? `${s.complete} of ${s.students} fully graded` : "No batch assigned yet"}
                      </span>
                    </span>
                    {s.batches > 0 && (
                      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-success" style={{ width: `${s.students ? (s.complete / s.students) * 100 : 0}%` }} />
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pending" className={cn(panel, "p-6 sm:p-8")}>
          <h2 id="pending" className="font-heading text-xl font-bold">Pending work</h2>
          {unbound.length + summary.missing.length === 0 ? (
            <p className="mt-5 flex items-center gap-3 rounded-2xl bg-success/10 p-4 font-medium text-success">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              All caught up. Every student has all 4 grades.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {unbound.map((s) => (
                <li key={`b-${s.id}`} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-4">
                  <Layers className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm">
                    <Link href={`${base}/${s.id}`} className={link}>{s.name} has no batch yet</Link>
                    <span className="block text-muted-foreground">Its students show up once an admin assigns a batch to it.</span>
                  </span>
                </li>
              ))}
              {summary.missing.map((m) => {
                const parts = GRADE_TYPES.filter((t) => m.byType[t.key]).map((t) => `${m.byType[t.key]} without ${t.label.toLowerCase()}`);
                return (
                  <li key={`m-${m.subjectId}`} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-4">
                    <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
                    <span className="text-sm">
                      <Link href={`${base}/${m.subjectId}`} className={link}>
                        {m.students} student{m.students === 1 ? "" : "s"} in {m.subject} {m.students === 1 ? "is" : "are"} missing grades
                      </Link>
                      <span className="block text-muted-foreground">{parts.join(", ")}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {summary.averages.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="performance" className={cn(panel, "min-w-0 p-6 sm:p-8")}>
            <h2 id="performance" className="font-heading text-xl font-bold">Class performance</h2>
            <p className="mt-1 text-sm text-muted-foreground">Average total by subject, out of 100, over the students with grades.</p>
            <ScoreBars data={summary.averages} counted="student graded" />
          </section>
          <section aria-labelledby="attention" className={cn(panel, "p-6 sm:p-8")}>
            <h2 id="attention" className="font-heading text-xl font-bold">Students who may need attention</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Lowest scores so far ({ATTENTION_MAX_PCT}% or below), as a share of the points possible for the grades given.</p>
            {summary.lowest.length === 0 ? (
              <p className="flex items-center gap-3 rounded-2xl bg-success/10 p-4 font-medium text-success">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                Everyone is above {ATTENTION_MAX_PCT}% so far.
              </p>
            ) : (
            <ul className="flex flex-col gap-1">
              {summary.lowest.map((x) => (
                <li key={`${x.id}-${x.subjectId}`}>
                  <Link href={`/teacher/records/${x.id}`} className="group flex items-center gap-3 rounded-2xl p-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40">
                    <Avatar src={x.hasPhoto ? `/teacher/students/${x.id}/photo` : null} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{x.name}</span>
                      <span className="block text-sm text-muted-foreground">{x.subject}, {x.total} of {x.possible} points</span>
                    </span>
                    <span className="font-heading text-xl font-bold tabular-nums">{x.pct}%</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
