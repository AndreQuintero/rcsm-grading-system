import { ChevronRight } from "lucide-react";
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
import { GRADE_TYPES, gradeTotal } from "@/lib/grading-shared";
import { GradeAverages } from "@/components/records/GradeAverages";
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

      {g.batches.some((b) => b.bound) && <GradeAverages grades={g.students.map((s) => s.grades)} title="Class averages" unit="student" />}

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
                        <span className="block text-[0.7rem] text-muted-foreground">{t.short}</span>
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
