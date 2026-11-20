import { CalendarCheck, ChevronRight, FileText, GraduationCap, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { Avatar } from "@/app/_dashboard/Avatar";
import { EmptyAnimation } from "@/components/empty-animation";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { periodLabel } from "@/lib/academic-semester";
import { requireTeacher, subjectGrading, teaches } from "@/lib/grading";
import { GRADE_TYPES, gradeAverages, gradeTotal, type Grades } from "@/lib/grading-shared";
import { cn } from "@/lib/utils";
import { BatchBinder } from "./BatchBinder";

type Params = { semesterId: string; subjectId: string };
const panel = "rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8";

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<main><HeaderSkeleton /><FormSkeleton fields={["Batches"]} /></main>}>
      <Subject params={params} />
    </Suspense>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Subject({ params }: { params: Promise<Params> }) {
  const [{ teacherId }, p] = await Promise.all([requireTeacher(), params]);
  const semesterId = Number(p.semesterId), subjectId = Number(p.subjectId);
  if (!Number.isInteger(semesterId) || !Number.isInteger(subjectId) || !(await teaches(semesterId, subjectId, teacherId))) notFound();
  const g = await subjectGrading(semesterId, subjectId);
  if (!g) notFound();
  const base = `/teacher/gradings/${semesterId}/${subjectId}`;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title={g.subject} description={periodLabel(g.period)} action={<BackLink href={`/teacher/gradings?semester=${semesterId}`} label="Back to gradings" />} />

      <section aria-labelledby="batches" className={panel}>
        <h2 id="batches" className="font-heading text-xl font-bold">Batches</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          The batches whose students you grade in this subject. Other teachers of this subject see the same batches and grades.
        </p>
        <BatchBinder semesterId={semesterId} subjectId={subjectId} batches={g.batches} />
      </section>

      {g.batches.some((b) => b.bound) && <Averages students={g.students} />}

      <section aria-labelledby="students" className={panel}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="students" className="font-heading text-xl font-bold">Students</h2>
          <p className="text-sm text-muted-foreground">{g.students.length} student{g.students.length === 1 ? "" : "s"}. Select one to grade them.</p>
        </div>
        {g.students.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <EmptyAnimation />
            {g.batches.some((b) => b.bound) ? "The added batches have no active students." : "Add a batch to see its students here."}
          </div>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {g.students.map((s) => {
              const { total, given } = gradeTotal(s.grades);
              return (
                <li key={s.id}>
                  <Link
                    href={`${base}/${s.id}`}
                    className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 rounded-2xl px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40 lg:grid-cols-[auto_minmax(0,1fr)_repeat(4,3.5rem)_5.5rem_auto]"
                  >
                    <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-11" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{s.batch} <StatusBadge status={s.status} /></span>
                    </span>
                    {GRADE_TYPES.map((t) => (
                      <span key={t.key} className="hidden text-center lg:block">
                        <span className="block text-[0.7rem] text-muted-foreground">{t.label.split(" ")[0]}</span>
                        <span className="font-medium tabular-nums">{s.grades[t.key] ?? "–"}</span>
                      </span>
                    ))}
                    <span className="hidden text-right lg:block">
                      <span className="block text-[0.7rem] text-muted-foreground">Total</span>
                      {given ? (
                        <>
                          <span className="font-heading text-lg font-bold tabular-nums">{total}</span>
                          <span className="text-sm text-muted-foreground"> / 100</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not graded</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 lg:contents">
                      <span className="text-sm text-muted-foreground tabular-nums lg:hidden">{given ? `${total} / 100` : "Not graded"}</span>
                      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

const TYPE_LOOK = {
  midterm: { icon: FileText, tint: "bg-primary/10 text-primary" },
  participation: { icon: MessagesSquare, tint: "bg-amber-500/12 text-amber-700" },
  presence: { icon: CalendarCheck, tint: "bg-success/12 text-success" },
  final_exam: { icon: GraduationCap, tint: "bg-sidebar/8 text-sidebar" },
};
const one = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// Class averages, laid out like the dashboard's stat row; the total stands out in charcoal.
function Averages({ students }: { students: { grades: Grades }[] }) {
  const a = gradeAverages(students.map((s) => s.grades));
  const counted = (n: number) => (n ? `${n} student${n === 1 ? "" : "s"} graded` : "No grades yet");
  return (
    <section aria-labelledby="averages" className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card">
      <h2 id="averages" className="sr-only">Class averages</h2>
      <dl className="grid grid-cols-2 lg:grid-cols-5">
        {GRADE_TYPES.map((t, i) => {
          const { icon: Icon, tint } = TYPE_LOOK[t.key];
          return (
            <div key={t.key} className={cn("flex flex-col gap-3 border-border/70 p-6", i % 2 === 0 && "border-r", i < 2 && "border-b", "lg:border-b-0 lg:border-r")}>
              <dt className="flex min-h-10 items-center gap-2.5 text-sm text-muted-foreground">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tint)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {t.label} average
              </dt>
              <dd className="font-heading text-4xl font-bold tabular-nums">
                {a[t.key].avg === null ? "–" : one(a[t.key].avg!)}
                <span className="text-lg font-medium text-muted-foreground"> / 25</span>
              </dd>
              <dd className="text-sm text-muted-foreground">{counted(a[t.key].n)}</dd>
            </div>
          );
        })}
        <div className="col-span-2 flex flex-col gap-3 bg-sidebar p-6 text-white lg:col-span-1">
          <dt className="flex min-h-10 items-center text-sm text-white/70">Total average</dt>
          <dd className="font-heading text-4xl font-bold tabular-nums">
            {a.total.avg === null ? "–" : one(a.total.avg)}
            <span className="text-lg font-medium text-white/60"> / 100</span>
          </dd>
          <dd className="text-sm text-white/70">{counted(a.total.n)}</dd>
        </div>
      </dl>
    </section>
  );
}
