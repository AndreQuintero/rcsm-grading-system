import { CalendarCheck, FileText, GraduationCap, MessagesSquare } from "lucide-react";
import { GRADE_TYPES, gradeAverages, type Grades } from "@/lib/grading-shared";
import { cn } from "@/lib/utils";

const TYPE_LOOK = {
  midterm: { icon: FileText, tint: "bg-primary/10 text-primary" },
  participation: { icon: MessagesSquare, tint: "bg-amber-500/12 text-amber-700" },
  presence: { icon: CalendarCheck, tint: "bg-success/12 text-success" },
  final_exam: { icon: GraduationCap, tint: "bg-sidebar/8 text-sidebar" },
};
const one = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// Averages of each grade type and of the total, laid out like the dashboard's stat row; the total stands out in
// charcoal. `unit` names what was counted ("student" on a subject page, "subject" on a student's record).
export function GradeAverages({ grades, title, unit }: { grades: Grades[]; title: string; unit: "student" | "subject" }) {
  const a = gradeAverages(grades);
  const counted = (n: number) => (n ? `${n} ${unit}${n === 1 ? "" : "s"} graded` : "No grades yet");
  return (
    <section aria-labelledby="averages" className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card">
      <h2 id="averages" className="sr-only">{title}</h2>
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
