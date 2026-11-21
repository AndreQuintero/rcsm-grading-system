import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SemesterSelect } from "@/app/_dashboard/SemesterSelect";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel } from "@/lib/academic-semester";
import { batchPeriod } from "@/lib/batch";
import { periodKey, pickDefault } from "@/lib/dashboard";
import { todayIso } from "@/lib/dates";
import { requireTeacher, teacherSemesters, teacherSubjects } from "@/lib/grading";

type SearchParams = { semester?: string };

const header = <PageHeader title="Gradings" description="Grade the students of the subjects you teach." />;

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main>
      {header}
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-36 rounded-[1.75rem]" /><Skeleton className="h-36 rounded-[1.75rem]" /></div>}>
        <Subjects searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// The session and searchParams are request-time data, so they sit under Suspense (cacheComponents).
async function Subjects({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ teacherId }, sp] = await Promise.all([requireTeacher(), searchParams]);
  const choices = await teacherSemesters(teacherId);
  const selected = choices.find((c) => String(c.id) === sp.semester) ?? pickDefault(choices);

  if (!selected)
    return (
      <section aria-labelledby="no-semester" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
        <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
        <h2 id="no-semester" className="mt-2 font-heading text-2xl font-bold">No semester assigned to you yet</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          Once an admin adds you to an academic semester with the subjects you teach, they will show up here for grading.
        </p>
      </section>
    );

  const subjects = await teacherSubjects(selected.id, teacherId);
  const nowKey = periodKey(batchPeriod(todayIso()));
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">{periodLabel(selected)}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            You teach {subjects.length} subject{subjects.length === 1 ? "" : "s"} this semester.
          </p>
        </div>
        <SemesterSelect
          basePath="/teacher/gradings"
          value={selected.id}
          choices={choices.map((c) => ({ id: c.id, label: periodLabel(c), current: periodKey(c) === nowKey }))}
        />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {subjects.map((s) => {
          const pct = s.students ? Math.round((s.complete / s.students) * 100) : 0;
          return (
            <li key={s.id}>
              <Link
                href={`/teacher/gradings/${selected.id}/${s.id}`}
                className="group flex h-full flex-col gap-5 rounded-[1.75rem] border border-border/70 bg-card p-6 outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_12px_32px_-16px_rgba(46,99,207,0.35)] focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BookOpen className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-xl font-bold leading-tight">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.batches ? `${s.batches} batch${s.batches === 1 ? "" : "es"}, ${s.students} student${s.students === 1 ? "" : "s"}` : "No batches added yet"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
                {s.students > 0 && (
                  <div>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-muted-foreground">Fully graded</span>
                      <span className="font-medium tabular-nums">{s.complete} of {s.students}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
