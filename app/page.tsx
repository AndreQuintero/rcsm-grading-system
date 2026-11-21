import { BookOpen, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LottiePlayer } from "@/components/lottie-player";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel } from "@/lib/academic-semester";
import { getSession } from "@/lib/auth/session";
import { batchPeriod } from "@/lib/batch";
import { dashboardCounts, periodKey, pickDefault, semesterChoices, semesterDetail, semesterRanking, type RankedStudent } from "@/lib/dashboard";
import { formatDate, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { RankingList } from "@/components/records/RankingList";
import { Avatar } from "./_dashboard/Avatar";
import { SemesterSelect } from "./_dashboard/SemesterSelect";
import { TeacherList } from "./_dashboard/TeacherList";

type SearchParams = { semester?: string };

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
const panel = "rounded-[1.75rem] border border-border/70 bg-card";

export default function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

// The session, searchParams and the counts are request-time data, so they sit under Suspense (cacheComponents).
async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, session, counts, choices] = await Promise.all([searchParams, getSession(), dashboardCounts(), semesterChoices()]);
  const asked = choices.find((c) => String(c.id) === sp.semester);
  const selected = asked ?? pickDefault(choices);
  const nowKey = periodKey(batchPeriod(todayIso()));
  const firstName = session?.username.split(" ")[0] ?? "";

  return (
    <main className="flex flex-col gap-8">
      <Overview firstName={firstName} counts={counts} />
      {selected ? (
        <Semester
          id={selected.id}
          period={periodLabel(selected)}
          choices={choices.map((c) => ({ id: c.id, label: periodLabel(c), current: periodKey(c) === nowKey }))}
        />
      ) : (
        <NoSemesters />
      )}
    </main>
  );
}

function Overview({ firstName, counts }: { firstName: string; counts: Awaited<ReturnType<typeof dashboardCounts>> }) {
  const parts = [
    { key: "full_time", label: "Full time", n: counts.full_time, bar: "bg-success", glow: "bg-success/60" },
    { key: "audit", label: "Audit", n: counts.audit, bar: "bg-primary", glow: "bg-primary/60" },
    { key: "inactive", label: "Inactive", n: counts.inactive, bar: "bg-muted-foreground/35", glow: "bg-muted-foreground/30" },
  ];
  const stats: { label: string; n: number; href: string; link: string; icon: LucideIcon; tint: string }[] = [
    { label: "Teachers", n: counts.teachers, href: "/teachers", link: "View teachers", icon: Users, tint: "bg-primary/10 text-primary" },
    { label: "Subjects", n: counts.subjects, href: "/subjects", link: "View subjects", icon: BookOpen, tint: "bg-amber-500/12 text-amber-700" },
    { label: "Admins", n: counts.admins, href: "/admins", link: "View admins", icon: ShieldCheck, tint: "bg-sidebar/8 text-sidebar" },
    { label: "Active users", n: counts.active_users, href: "/users", link: "View users", icon: UserCheck, tint: "bg-success/12 text-success" },
  ];

  return (
    <section aria-labelledby="welcome" className={cn(panel, "overflow-hidden")}>
      <div className="grid items-center gap-6 px-6 pt-8 pb-6 sm:px-10 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <h1 id="welcome" className="font-heading text-2xl font-bold sm:text-3xl">Welcome back{firstName && `, ${firstName}`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate(todayIso())}</p>

          <div className="mt-8 flex flex-wrap items-end gap-x-5 gap-y-2">
            <p className="font-heading text-8xl leading-[0.8] font-bold tracking-tight tabular-nums sm:text-[8.5rem]">
              {counts.students.toLocaleString("en-US")}
            </p>
            <p className="pb-1 text-muted-foreground">
              {counts.students === 1 ? "student" : "students"} at the school
            </p>
          </div>

          {/* students by study type; the blurred copy underneath gives the bar its glow */}
          <div className="relative mt-8 max-w-2xl" role="img" aria-label={parts.map((p) => `${p.n} ${p.label.toLowerCase()}`).join(", ")}>
            <div className="absolute inset-x-2 top-3 flex h-8 gap-1 blur-xl" aria-hidden="true">
              {parts.map((p) => p.n > 0 && <span key={p.key} className={p.glow} style={{ flexGrow: p.n }} />)}
            </div>
            <div className="relative flex h-10 gap-1 overflow-hidden rounded-full bg-muted p-1">
              {counts.students === 0 ? (
                <span className="flex-1" />
              ) : (
                parts.map((p) => p.n > 0 && <span key={p.key} className={cn("rounded-full first:rounded-l-full", p.bar)} style={{ flexGrow: p.n }} />)
              )}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-hidden="true">
              {parts.map((p) => (
                <li key={p.key} className="flex items-center gap-2 text-muted-foreground">
                  <span className={cn("size-2.5 rounded-full", p.bar)} />
                  {p.label}
                  <span className="font-medium text-foreground tabular-nums">{p.n.toLocaleString("en-US")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <LottiePlayer name="business-plan" className="hidden size-72 md:block lg:size-80" />
      </div>

      <dl className="grid grid-cols-2 border-t border-border/70 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={cn("flex flex-col gap-3 px-6 py-6 sm:px-8", "border-border/70", i % 2 === 0 && "border-r", i === 1 && "lg:border-r", i < 2 && "border-b lg:border-b-0")}>
            <dt className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <span className={cn("grid size-8 place-items-center rounded-lg", s.tint)}>
                <s.icon className="size-4" aria-hidden="true" />
              </span>
              {s.label}
            </dt>
            <dd className="font-heading text-4xl font-bold tabular-nums">{s.n.toLocaleString("en-US")}</dd>
            <dd>
              <Link href={s.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{s.link}</Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function Semester({ id, period, choices }: { id: number; period: string; choices: { id: number; label: string; current: boolean }[] }) {
  const [{ teachers, batches }, ranking] = await Promise.all([semesterDetail(id), semesterRanking(id)]);
  const students = batches.reduce((n, b) => n + b.students.length, 0);

  return (
    <>
      <section aria-labelledby="semester" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <LottiePlayer name="calendar-booking" className="hidden aspect-[16/9] w-28 shrink-0 sm:block" />
          <div>
            <h2 id="semester" className="font-heading text-2xl font-bold">{period}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {batches.length} batch{batches.length === 1 ? "" : "es"}, {plural(teachers.length, "teacher")} and {plural(students, "active student")}
            </p>
          </div>
        </div>
        <SemesterSelect choices={choices} value={id} />
      </section>

      <section aria-labelledby="teachers" className={cn(panel, "p-6 sm:p-8")}>
        <div className="mb-4 flex items-center gap-3">
          <LottiePlayer name="employee-content" className="-my-3 -ml-2 size-16 shrink-0" />
          <div>
            <h2 id="teachers" className="font-heading text-xl font-bold">Teachers</h2>
            <p className="text-sm text-muted-foreground">Select a teacher to see the subjects they teach this semester.</p>
          </div>
        </div>
        {teachers.length ? (
          <TeacherList teachers={teachers} period={period} />
        ) : (
          <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            No teachers in this semester yet. <Link href={`/academic-semesters/${id}/edit`} className="font-medium text-primary underline-offset-4 hover:underline">Add teachers</Link>
          </p>
        )}
      </section>

      {batches.length === 0 && (
        <p className={cn(panel, "px-6 py-8 text-center text-sm text-muted-foreground")}>
          No batches in this semester yet. <Link href={`/academic-semesters/${id}/edit`} className="font-medium text-primary underline-offset-4 hover:underline">Add batches</Link>
        </p>
      )}
      {batches.map((b) => {
        const fullTime = b.students.filter((s) => s.status === "full_time").length;
        return (
          <section key={b.id} aria-labelledby={`batch-${b.id}`} className={cn(panel, "p-6 sm:p-8")}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id={`batch-${b.id}`} className="font-heading text-xl font-bold">{b.label}</h2>
              <ul className="flex flex-wrap gap-2 text-xs font-medium">
                <li className="rounded-full bg-muted px-3 py-1">{plural(b.students.length, "student")}</li>
                <li className="rounded-full bg-success/12 px-3 py-1 text-success">{fullTime} full time</li>
                <li className="rounded-full bg-primary/12 px-3 py-1 text-primary">{b.students.length - fullTime} audit</li>
              </ul>
            </div>
            {b.students.length ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {b.students.map((s) => (
                  <li key={s.id}>
                    {/* the batch is in this semester, so it is one of the student's semesters (never a not-found record) */}
                    <Link
                      href={`/student-records/${s.id}/${id}`}
                      className="flex items-center gap-3 rounded-2xl bg-muted/45 p-3 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <Avatar src={s.hasPhoto ? `/students/${s.id}/photo` : null} className="size-12" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {s.age} years old <StatusBadge status={s.status} />
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">This batch has no active students.</p>
            )}
          </section>
        );
      })}

      {batches.length > 0 && <TopStudents ranking={ranking} semesterId={id} period={period} />}
    </>
  );
}

// Best average per subject in the semester; tied students share a place.
function TopStudents({ ranking, semesterId, period }: { ranking: (RankedStudent & { place: number })[]; semesterId: number; period: string }) {
  return (
    <section aria-labelledby="top-students" className={cn(panel, "p-6 sm:p-8")}>
      <div className="mb-4">
        <h2 id="top-students" className="font-heading text-xl font-bold">Top students</h2>
        <p className="text-sm text-muted-foreground">Best average per subject in {period}.</p>
      </div>
      {ranking.length ? (
        <RankingList
          rows={ranking.map((s) => ({
            id: s.id, name: s.name, place: s.place, photo: s.hasPhoto ? `/students/${s.id}/photo` : null,
            href: `/student-records/${s.id}/${semesterId}`,
            detail: <>{s.batch ?? "No batch"}<span className="max-sm:hidden"> · {plural(s.subjects, "subject")} graded</span></>,
            value: (
              <>
                <span className="font-heading text-xl font-bold tabular-nums">{s.score}</span>
                <span className="hidden text-sm text-muted-foreground sm:inline"> / 100</span>
              </>
            ),
          }))}
        />
      ) : (
        <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">No grades yet this semester.</p>
      )}
    </section>
  );
}

function NoSemesters() {
  return (
    <section aria-labelledby="no-semesters" className={cn(panel, "flex flex-col items-center px-6 py-10 text-center")}>
      <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
      <h2 id="no-semesters" className="mt-2 font-heading text-2xl font-bold">No academic semesters yet</h2>
      <p className="mt-2 max-w-md text-muted-foreground">Register a semester to see its teachers, their subjects and its batches here.</p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/academic-semesters/new">
          <Plus aria-hidden="true" />
          Register academic semester
        </Link>
      </Button>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <main className="flex flex-col gap-8" aria-busy="true">
      <span role="status" className="sr-only">Loading</span>
      <div className={cn(panel, "space-y-6 p-8")} aria-hidden="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-48" />
        <Skeleton className="h-10 w-full max-w-2xl rounded-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-[1.75rem]" aria-hidden="true" />
    </main>
  );
}
