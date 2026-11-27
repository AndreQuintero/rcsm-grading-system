import { CalendarCheck, ChevronRight, ClipboardList, MessagesSquare } from "lucide-react";
import Link from "next/link";
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

// The weekly meeting's three class work cards for one subject: attendance rate with the counts, the class average %
// earned in the meeting's assignments (the card opens them), and the participation average out of 100.
export function ClassWorkAverages({ marks, assignments, assignmentsHref }: { marks: Marks[]; assignments: number; assignmentsHref: string }) {
  const s = meetingSummary(marks);
  const c = s.attendance.counts;
  const card = "flex h-full flex-col gap-3 rounded-[1.75rem] border border-border/70 bg-card p-6";
  const head = (Icon: typeof CalendarCheck, tint: string, label: string) => (
    <span className="flex min-h-10 items-center gap-2.5 text-sm text-muted-foreground">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tint)}><Icon className="size-4" aria-hidden="true" /></span>
      {label}
    </span>
  );
  const big = "font-heading text-4xl font-bold whitespace-nowrap tabular-nums";
  const small = "text-lg font-medium text-muted-foreground";
  const scored = (n: number) => `${n} student${n === 1 ? "" : "s"}`;
  return (
    <section aria-labelledby="summary">
      <h2 id="summary" className="sr-only">Class work</h2>
      <ul className="grid gap-4 md:grid-cols-3">
        <li className={card}>
          {head(CalendarCheck, "bg-success/12 text-success", "Attendance")}
          <span className={big}>{s.attendance.pct === null ? "–" : `${s.attendance.pct}%`}<span className={small}> present</span></span>
          <span className="text-sm text-muted-foreground">
            {s.attendance.n ? `${c.present} present · ${c.late} late · ${c.absent} absent · ${c.excused} excused` : "No attendance yet"}
          </span>
        </li>
        <li>
          <Link
            href={assignmentsHref}
            className={cn(card, "group outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_12px_32px_-16px_rgba(46,99,207,0.35)] focus-visible:ring-3 focus-visible:ring-ring/40")}
          >
            <span className="flex items-start justify-between gap-2">
              {head(ClipboardList, "bg-primary/10 text-primary", "Assignments and Activities")}
              <ChevronRight className="mt-2.5 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className={big}>{s.assignments.avg === null ? "–" : `${Math.round(s.assignments.avg)}%`}<span className={small}> average</span></span>
            <span className="text-sm text-muted-foreground">
              {assignments ? `${assignments} assignment${assignments === 1 ? "" : "s"} · ${scored(s.assignments.n)} scored` : "No assignments yet. Open to register one."}
            </span>
          </Link>
        </li>
        <li className={card}>
          {head(MessagesSquare, "bg-amber-500/12 text-amber-700", "Participation")}
          <span className={big}>{s.participation.avg === null ? "–" : one(s.participation.avg)}<span className={small}> / 100</span></span>
          <span className="text-sm text-muted-foreground">{s.participation.n ? `${scored(s.participation.n)} marked` : "No marks yet"}</span>
        </li>
      </ul>
    </section>
  );
}
