import { ChevronRight, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { Avatar } from "@/app/_dashboard/Avatar";
import { GradeAverages } from "@/app/teacher/_shared/GradeAverages";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { periodLabel } from "@/lib/academic-semester";
import { requireTeacher, studentRecord } from "@/lib/grading";
import { GRADE_TYPES, gradeTotal, overallScore, subjectAverages } from "@/lib/grading-shared";
import { ScoreBars } from "../_charts/ScoreBars";
import { ScoreGauge } from "../_charts/ScoreGauge";

const panel = "rounded-[1.75rem] border border-border/70 bg-card";
const header = <PageHeader title="Score record" description="This student's grades in the subjects you teach." action={<BackLink href="/teacher/records" label="Back to score records" />} />;

export default function Page({ params }: { params: Promise<{ studentId: string }> }) {
  return (
    <main className="flex flex-col gap-6">
      {header}
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-48 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-[1.75rem]" /></div>}>
        <Record params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Record({ params }: { params: Promise<{ studentId: string }> }) {
  const [{ teacherId }, p] = await Promise.all([requireTeacher(), params]);
  const id = Number(p.studentId);
  const r = Number.isInteger(id) && id > 0 ? await studentRecord(teacherId, id) : null;
  if (!r) notFound();
  const graded = r.rows.filter((x) => gradeTotal(x.grades).given > 0);
  const score = overallScore(graded);

  return (
    <>
      <section aria-labelledby="student" className={`${panel} grid items-center gap-6 overflow-hidden p-6 sm:p-8 md:grid-cols-[1fr_auto]`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar src={r.hasPhoto ? `/teacher/students/${r.id}/photo` : null} className="size-24 ring-4 ring-accent" />
          <div className="min-w-0">
            <h2 id="student" className="font-heading text-3xl font-bold leading-tight">{r.name}</h2>
            <div className="mt-2"><StatusBadge status={r.status} /></div>
            <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Age</dt><dd className="font-medium">{r.age} years old</dd></div>
              <div><dt className="text-muted-foreground">Batch</dt><dd className="font-medium">{r.batch ?? "No batch"}</dd></div>
              {r.email && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd><a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 break-all text-primary underline-offset-4 hover:underline"><Mail className="size-4 shrink-0" aria-hidden="true" />{r.email}</a></dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <LottiePlayer name="data-analysis" className="hidden size-48 md:block lg:size-56" />
      </section>

      {graded.length === 0 ? (
        <section aria-labelledby="no-records" className={`${panel} flex flex-col items-center px-6 py-10 text-center`}>
          <LottiePlayer name="data-not-found" className="aspect-[426/290] w-64" />
          <h2 id="no-records" className="mt-2 font-heading text-2xl font-bold">No records yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">This student has no grades in your subjects yet. Their grades will appear here once they are saved.</p>
        </section>
      ) : (
        <>
          <GradeAverages grades={graded.map((x) => x.grades)} title="Score averages" unit="subject" />

          <section aria-labelledby="grades" className={`${panel} py-6`}>
            <h2 id="grades" className="mb-3 px-6 font-heading text-xl font-bold sm:px-8">Grades by subject</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 sm:pl-8">Semester</TableHead>
                  <TableHead>Subject</TableHead>
                  {GRADE_TYPES.map((t) => <TableHead key={t.key} className="text-center">{t.label}</TableHead>)}
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12 pr-6 sm:pr-8"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.rows.map((x) => {
                  const t = gradeTotal(x.grades);
                  return (
                    <TableRow key={`${x.semesterId}-${x.subjectId}`}>
                      <TableCell className="pl-6 text-muted-foreground sm:pl-8">{periodLabel(x.period)}</TableCell>
                      <TableCell className="font-medium">{x.subject}</TableCell>
                      {GRADE_TYPES.map((g) => <TableCell key={g.key} className="text-center tabular-nums">{x.grades[g.key] ?? "–"}</TableCell>)}
                      <TableCell className="text-right tabular-nums">
                        {t.given ? <><span className="font-heading text-base font-bold">{t.total}</span><span className="text-muted-foreground"> / 100</span></> : <span className="text-muted-foreground">Not graded</span>}
                      </TableCell>
                      <TableCell className="pr-6 sm:pr-8">
                        <Link href={`/teacher/gradings/${x.semesterId}/${x.subjectId}`} aria-label={`Open ${x.subject}, ${periodLabel(x.period)}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40">
                          <ChevronRight className="size-4" aria-hidden="true" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section aria-labelledby="by-subject" className={`${panel} min-w-0 p-6 sm:p-8`}>
              <h2 id="by-subject" className="font-heading text-xl font-bold">Average total by subject</h2>
              <p className="mt-1 text-sm text-muted-foreground">Out of 100. A subject taught in more than one semester shows the average of its totals.</p>
              <ScoreBars data={subjectAverages(graded)} />
            </section>
            <section aria-labelledby="overall" className={`${panel} flex flex-col p-6 sm:p-8`}>
              <h2 id="overall" className="font-heading text-xl font-bold">Overall performance</h2>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">Points earned out of the points possible for the grades given so far.</p>
              <div className="flex flex-1 items-center justify-center">
                <ScoreGauge earned={score.earned} possible={score.possible} pct={score.pct ?? 0} />
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
