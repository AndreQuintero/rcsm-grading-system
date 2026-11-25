import { BookOpen, CheckCircle2, Pencil, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { BackLink } from "@/app/BackLink";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { HeaderSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel, semesterSubjectBatches } from "@/lib/academic-semester";
import { requireRole } from "@/lib/auth/session";
import { SubjectBatchBinder } from "./SubjectBatchBinder";

type Params = { id: string };
const panel = "rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true">
            <span role="status" className="sr-only">Loading</span>
            <HeaderSkeleton />
            <Skeleton className="h-48 rounded-[1.75rem]" />
            <Skeleton className="h-40 rounded-[1.75rem]" />
          </div>
        }
      >
        <Subjects params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Subjects({ params }: { params: Promise<Params> }) {
  await requireRole("admin");
  const id = Number((await params).id);
  const r = Number.isInteger(id) && id > 0 ? await semesterSubjectBatches(id) : null;
  if (!r) notFound();
  const editHref = `/academic-semesters/${id}/edit`;
  const missing = r.subjects.filter((s) => s.bound.length === 0).length;
  const editButton = (label: string) => (
    <Button asChild size="lg" className="mt-6">
      <Link href={editHref}><Pencil aria-hidden="true" />{label}</Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Assign batches"
        description={`The batches whose students each subject grades in ${periodLabel(r.period)}.`}
        action={<BackLink href={editHref} label="Back to the academic semester" />}
      />

      {r.subjects.length === 0 ? (
        <section aria-labelledby="no-subjects" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
          <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
          <h2 id="no-subjects" className="mt-2 font-heading text-2xl font-bold">No subjects in this semester yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Assign subjects to a teacher on the semester&apos;s form first. Then come back to choose the batches each subject grades.
          </p>
          {editButton("Assign subjects to teachers")}
        </section>
      ) : (
        <>
          <section aria-labelledby="semester" className="grid items-center gap-6 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <h2 id="semester" className="font-heading text-3xl font-bold leading-tight">{periodLabel(r.period)}</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Subjects</dt><dd className="font-medium">{r.subjects.length}</dd></div>
                <div><dt className="text-muted-foreground">Batches in the semester</dt><dd className="font-medium">{r.batches.length}</dd></div>
                <div><dt className="text-muted-foreground">Subjects without a batch</dt><dd className="font-medium">{missing}</dd></div>
              </dl>
              {missing === 0 ? (
                <p className="mt-5 flex items-center gap-3 rounded-2xl bg-success/10 p-4 text-sm font-medium text-success">
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                  Every subject has a batch.
                </p>
              ) : (
                <p className="mt-5 flex items-center gap-3 rounded-2xl bg-amber-500/12 p-4 text-sm font-medium text-amber-800">
                  <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
                  {plural(missing, "subject")} {missing === 1 ? "has" : "have"} no batch yet. Their teachers can&apos;t grade anyone until you assign one.
                </p>
              )}
            </div>
            <LottiePlayer name="calendar-booking" className="hidden size-48 md:block lg:size-56" />
          </section>

          <section aria-labelledby="subjects">
            <h2 id="subjects" className="mb-4 font-heading text-xl font-bold">Subjects</h2>
            <ul className="flex flex-col gap-4">
              {r.subjects.map((s) => (
                <li key={s.id} className={panel}>
                  <div className="flex flex-wrap items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex flex-wrap items-center gap-2 font-heading text-xl font-bold leading-tight">
                        {s.name}
                        {s.bound.length === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-0.5 font-sans text-xs font-medium text-amber-800">
                            <TriangleAlert className="size-3.5" aria-hidden="true" />No batch yet
                          </span>
                        )}
                      </h3>
                      <ul aria-label={`Teachers of ${s.name}`} className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                        {s.teachers.map((t) => (
                          <li key={t.id} className="flex min-w-0 items-center gap-3">
                            <Avatar src={t.hasPhoto ? `/teachers/${t.id}/photo` : null} className="size-9" />
                            <span className="min-w-0 text-sm">
                              <span className="block truncate font-medium">{t.name}</span>
                              <span className="block truncate text-muted-foreground">{t.email}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-border/70 pt-5">
                    {r.batches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This semester has no batches yet. <Link href={editHref} className="font-medium text-primary underline-offset-4 hover:underline">Add batches to the semester first</Link>.
                      </p>
                    ) : (
                      <SubjectBatchBinder semesterId={id} subjectId={s.id} subject={s.name} batches={r.batches} boundIds={s.bound} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
