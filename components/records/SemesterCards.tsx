import { CalendarRange, ChevronRight, Layers3 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LottiePlayer } from "@/components/lottie-player";
import { periodLabel } from "@/lib/academic-semester";
import type { StudentRecordView } from "@/lib/student-records";

const one = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// The student's semesters as cards (plus a first "All semesters" card), or `empty` when they have none. Shared by the
// admin view and the student's own "My records"; cards link to `${base}/<semester id | all>`.
export function SemesterCards({ semesters, base, empty, self = false }: {
  semesters: StudentRecordView["semesters"]; base: string; empty: ReactNode; self?: boolean;
}) {
  return (
    <>
      {semesters.length === 0 ? (
        <section aria-labelledby="no-semesters" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
          <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
          {empty}
        </section>
      ) : (
        <section aria-labelledby="semesters">
          <h2 id="semesters" className="mb-4 font-heading text-xl font-bold">Semesters</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            <li>
              <Link
                href={`${base}/all`}
                className="group flex h-full flex-col gap-5 rounded-[1.75rem] bg-sidebar p-6 text-white outline-none transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(43,46,51,0.6)] focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10"><Layers3 className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-xl font-bold leading-tight">All semesters</h3>
                    <p className="mt-1 text-sm text-white/70">Every grade{self ? " of yours" : " of this student"} in one record, with the charts across semesters.</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
                <p className="text-sm text-white/70">{semesters.length} semester{semesters.length === 1 ? "" : "s"}</p>
              </Link>
            </li>
            {semesters.map((s) => (
              <li key={s.id}>
                <Link
                  href={`${base}/${s.id}`}
                  className="group flex h-full flex-col gap-5 rounded-[1.75rem] border border-border/70 bg-card p-6 outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_12px_32px_-16px_rgba(46,99,207,0.35)] focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarRange className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-xl font-bold leading-tight">{periodLabel(s)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.subjects ? `${s.graded} of ${s.subjects} subject${s.subjects === 1 ? "" : "s"} graded` : `No subjects grading ${self ? "you" : "this student"} yet`}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                  {s.totalAvg !== null && (
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total average</p>
                        <p className="font-heading text-3xl font-bold tabular-nums">{one(s.totalAvg)}<span className="text-base font-medium text-muted-foreground"> / 100</span></p>
                      </div>
                      <div className="min-w-0 flex-1 max-w-40">
                        <p className="mb-1.5 text-right text-sm text-muted-foreground tabular-nums">{s.pct}% of points</p>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
