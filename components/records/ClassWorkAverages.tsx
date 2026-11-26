import { CalendarCheck, ClipboardList, MessagesSquare } from "lucide-react";
import { attendanceLabel, meetingSummary, type Marks } from "@/lib/class-work-shared";
import { cn } from "@/lib/utils";

const one = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const ATTENDANCE_TONE: Record<string, string> = {
  present: "bg-success/12 text-success",
  late: "bg-amber-500/12 text-amber-800",
  absent: "bg-destructive/10 text-destructive",
  excused: "bg-primary/10 text-primary",
};

// A student's attendance status as a coloured pill, or a dash when not given.
export function AttendanceBadge({ value }: { value: Marks["attendance"] }) {
  if (!value) return <span className="text-muted-foreground">–</span>;
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", ATTENDANCE_TONE[value])}>{attendanceLabel(value)}</span>;
}

// The weekly meeting's summary for one subject, in the style of GradeAverages: attendance rate with the counts, and the
// average assignments and participation scores out of 100.
export function ClassWorkAverages({ marks }: { marks: Marks[] }) {
  const s = meetingSummary(marks);
  const c = s.attendance.counts;
  const block = "flex flex-col gap-3 border-border/70 p-6";
  const head = (Icon: typeof CalendarCheck, tint: string, label: string) => (
    <dt className="flex min-h-10 items-center gap-2.5 text-sm text-muted-foreground">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tint)}><Icon className="size-4" aria-hidden="true" /></span>
      {label}
    </dt>
  );
  const score = (k: "assignments" | "participation", Icon: typeof CalendarCheck, tint: string, label: string, last: boolean) => (
    <div className={cn(block, !last && "border-b md:border-b-0 md:border-r")}>
      {head(Icon, tint, label)}
      <dd className="font-heading text-4xl font-bold whitespace-nowrap tabular-nums">
        {s[k].avg === null ? "–" : one(s[k].avg!)}
        <span className="text-lg font-medium text-muted-foreground"> / 100</span>
      </dd>
      <dd className="text-sm text-muted-foreground">{s[k].n ? `${s[k].n} student${s[k].n === 1 ? "" : "s"} marked` : "No marks yet"}</dd>
    </div>
  );
  return (
    <section aria-labelledby="summary" className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card">
      <h2 id="summary" className="sr-only">Summary</h2>
      <dl className="grid md:grid-cols-3">
        <div className={cn(block, "border-b md:border-b-0 md:border-r")}>
          {head(CalendarCheck, "bg-success/12 text-success", "Attendance")}
          <dd className="font-heading text-4xl font-bold whitespace-nowrap tabular-nums">
            {s.attendance.pct === null ? "–" : `${s.attendance.pct}%`}
            <span className="text-lg font-medium text-muted-foreground"> present</span>
          </dd>
          <dd className="text-sm text-muted-foreground">
            {s.attendance.n ? `${c.present} present · ${c.late} late · ${c.absent} absent · ${c.excused} excused` : "No attendance yet"}
          </dd>
        </div>
        {score("assignments", ClipboardList, "bg-primary/10 text-primary", "Assignments average", false)}
        {score("participation", MessagesSquare, "bg-amber-500/12 text-amber-700", "Participation average", true)}
      </dl>
    </section>
  );
}
