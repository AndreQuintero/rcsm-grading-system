import { Mail, MessageSquareQuote } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { Avatar } from "@/app/_dashboard/Avatar";
import { SemesterSelect } from "@/app/_dashboard/SemesterSelect";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { GradeAverages } from "@/components/records/GradeAverages";
import { ScoreBars } from "@/components/records/ScoreBars";
import { ScoreGauge } from "@/components/records/ScoreGauge";
import { StudentHero } from "@/components/records/StudentHero";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel } from "@/lib/academic-semester";
import { requireRole } from "@/lib/auth/session";
import { batchPeriod } from "@/lib/batch";
import { periodKey } from "@/lib/dashboard";
import { formatDate, todayIso } from "@/lib/dates";
import { GRADE_TYPES, gradeTotal, overallScore, subjectAverages } from "@/lib/grading-shared";
import { studentSemesterRecord, studentSemesters } from "@/lib/student-records";

type Params = { studentId: string; semesterId: string };
const panel = "rounded-[1.75rem] border border-border/70 bg-card";

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-16 w-80" /><Skeleton className="h-48 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-[1.75rem]" /></div>}>
        <Record params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Record({ params }: { params: Promise<Params> }) {
  await requireRole("admin");
  const p = await params;
  // "all" = every semester of the student in one record; otherwise one semester id
  const all = p.semesterId === "all";
  const id = Number(p.studentId);
  const semesterId = all ? null : Number(p.semesterId);
  if (!Number.isInteger(id) || id < 1 || (!all && !(Number.isInteger(semesterId) && semesterId! > 0))) notFound();
  const list = await studentSemesters(id);
  if (!list) notFound();
  const records = await Promise.all((all ? list.semesters.map((s) => s.id) : [semesterId!]).map((sid) => studentSemesterRecord(id, sid)));
  if (records.some((x) => !x)) notFound();
  const rows = records.flatMap((rec) => rec!.rows.map((x) => ({ ...x, period: rec!.period })));
  const r = { ...list, rows };
  const graded = r.rows.filter((x) => gradeTotal(x.grades).given > 0);
  const semestersGraded = new Set(graded.map((x) => x.period.id)).size;
  const score = overallScore(graded);
  const nowKey = periodKey(batchPeriod(todayIso()));

  return (
    <>
      <PageHeader
        title="Student record"
        description="This student's grades in every subject, with the teachers who teach them. Pick one semester or all of them."
        action={<BackLink href={`/student-records/${id}`} label="Back to this student's semesters" />}
      />

      {/* same semester row as the admin dashboard: pick any of this student's semesters */}
      <section aria-labelledby="semester" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <LottiePlayer name="calendar-booking" className="hidden aspect-[16/9] w-28 shrink-0 sm:block" />
          <div>
            <h2 id="semester" className="font-heading text-2xl font-bold">{all ? "All semesters" : periodLabel(records[0]!.period)}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {r.rows.length
                ? `${graded.length} of ${r.rows.length} subject${r.rows.length === 1 ? "" : "s"} graded`
                : "No subjects grading this student yet"}
              {all
                ? semestersGraded > 0 && `, across ${semestersGraded} graded semester${semestersGraded === 1 ? "" : "s"}`
                : list.semesters.length > 1 && `, ${list.semesters.length} semesters in total`}
            </p>
          </div>
        </div>
        <SemesterSelect
          pathTemplate={`/student-records/${id}/{id}`}
          value={all ? "all" : semesterId!}
          choices={[
            { id: "all", label: "All semesters", current: false },
            ...list.semesters.map((s) => ({ id: s.id, label: periodLabel(s), current: periodKey(s) === nowKey })),
          ]}
        />
      </section>

      <StudentHero student={r} photo={r.hasPhoto ? `/students/${r.id}/photo` : null} lottie="data-analysis" />

      {graded.length === 0 ? (
        <section aria-labelledby="no-records" className={`${panel} flex flex-col items-center px-6 py-10 text-center`}>
          <LottiePlayer name="data-not-found" className="aspect-[426/290] w-64" />
          <h2 id="no-records" className="mt-2 font-heading text-2xl font-bold">No records yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            {all
              ? "No grades have been saved for this student in any semester yet."
              : r.rows.length ? "No grades have been saved for this student in this semester yet." : "No teacher has added this student's batch to a subject in this semester yet."}
          </p>
        </section>
      ) : (
        <GradeAverages grades={graded.map((x) => x.grades)} title="Score averages" unit="subject" />
      )}

      {r.rows.length > 0 && (
        <section aria-labelledby="grades" className={`${panel} p-6 sm:p-8`}>
          <h2 id="grades" className="mb-5 font-heading text-xl font-bold">Grades by subject</h2>
          <ul className="flex flex-col gap-4">
            {r.rows.map((x) => {
              const t = gradeTotal(x.grades);
              return (
                <li key={`${x.period.id}-${x.subjectId}`} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-heading text-lg font-bold">
                      {x.subject}
                      {all && <span className="ml-2 align-middle rounded-full bg-muted px-2.5 py-0.5 font-sans text-xs font-medium text-muted-foreground">{periodLabel(x.period)}</span>}
                    </h3>
                    <p className="tabular-nums">
                      {t.given ? <><span className="font-heading text-2xl font-bold">{t.total}</span><span className="text-muted-foreground"> / 100</span></> : <span className="text-sm text-muted-foreground">Not graded</span>}
                    </p>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {GRADE_TYPES.map((g) => (
                      <div key={g.key} className="rounded-xl bg-muted/50 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{g.label}</dt>
                        <dd className="font-medium tabular-nums">{x.grades[g.key] ?? "–"}<span className="text-sm text-muted-foreground"> / 25</span></dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">{x.teachers.length === 1 ? "Teacher" : "Teachers"}</p>
                    {x.teachers.length ? (
                      <ul className="flex flex-wrap gap-x-6 gap-y-3">
                        {x.teachers.map((tc) => (
                          <li key={tc.id} className="flex items-center gap-3">
                            <Avatar src={tc.hasPhoto ? `/teachers/${tc.id}/photo` : null} className="size-9" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{tc.name}</span>
                              <a href={`mailto:${tc.email}`} className="inline-flex items-center gap-1 text-xs break-all text-primary underline-offset-4 hover:underline"><Mail className="size-3 shrink-0" aria-hidden="true" />{tc.email}</a>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No teacher in this semester any more.</p>
                    )}
                  </div>
                  {x.comment && (
                    <p className="mt-4 flex gap-2 rounded-xl bg-accent/60 p-3 text-sm text-accent-foreground">
                      <MessageSquareQuote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="whitespace-pre-line">{x.comment}</span>
                    </p>
                  )}
                  {x.updated && <p className="mt-3 text-xs text-muted-foreground">Last saved by {x.updatedBy ?? "a former user"} on {formatDate(x.updated)} UTC</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {graded.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section aria-labelledby="by-subject" className={`${panel} min-w-0 p-6 sm:p-8`}>
            <h2 id="by-subject" className="font-heading text-xl font-bold">Average total by subject</h2>
            <p className="mt-1 text-sm text-muted-foreground">{all ? "Out of 100. A subject taken in more than one semester shows the average of its totals." : "Out of 100, for the subjects with grades in this semester."}</p>
            <ScoreBars data={subjectAverages(graded)} counted={all ? "semester" : "none"} />
          </section>
          <section aria-labelledby="overall" className={`${panel} flex flex-col p-6 sm:p-8`}>
            <h2 id="overall" className="font-heading text-xl font-bold">Overall performance</h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">Points earned out of the points possible for the grades given so far.</p>
            <div className="flex flex-1 items-center justify-center">
              <ScoreGauge earned={score.earned} possible={score.possible} pct={score.pct ?? 0} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
