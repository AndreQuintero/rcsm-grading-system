"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { ATTENDANCE, type Attendance } from "@/lib/class-work-shared";
import { cn } from "@/lib/utils";
import { saveAttendanceAction } from "../../actions";

type Student = { id: number; name: string; hasPhoto: boolean; batch: string; attendance: Attendance | null };

// The colour of each status when picked (the same tones as the attendance badges).
const PICKED: Record<Attendance, string> = {
  present: "has-checked:border-success has-checked:bg-success/12 has-checked:text-success",
  late: "has-checked:border-amber-500 has-checked:bg-amber-500/12 has-checked:text-amber-800",
  absent: "has-checked:border-destructive has-checked:bg-destructive/10 has-checked:text-destructive",
  excused: "has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary",
};

// One row per student with the four statuses as native radios (controlled, so React's form reset after the action
// doesn't lose them). A student left without a status keeps none.
export function AttendanceForm({ meetingId, subjectId, students, back }: { meetingId: number; subjectId: number; students: Student[]; back: string }) {
  const saved = useSavedRedirect(back);
  const [picked, setPicked] = useState<Record<number, Attendance | "">>(() => Object.fromEntries(students.map((s) => [s.id, s.attendance ?? ""])));
  const [state, action, pending] = useActionState(async (prev: { error?: string; message?: string }, fd: FormData) => {
    const r = await saveAttendanceAction(meetingId, subjectId, prev, fd);
    if (!r.error) saved(r.message);
    return r;
  }, {});
  const counts = ATTENDANCE.map((a) => ({ ...a, n: Object.values(picked).filter((v) => v === a.key).length }));
  const missing = Object.values(picked).filter((v) => v === "").length;

  return (
    <form action={action}>
      <FormCard
        footer={
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save attendance"}</Button>
        }
      >
        <FieldError message={state.error} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
          {counts.map((c) => <span key={c.key}><span className="font-medium text-foreground tabular-nums">{c.n}</span> {c.label.toLowerCase()}</span>)}
          <span><span className="font-medium text-foreground tabular-nums">{missing}</span> not taken</span>
        </p>
        <ul className="flex flex-col divide-y divide-border/70 rounded-2xl border border-border/70">
          {students.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-11" />
              <span className="min-w-0 flex-1">
                <span id={`st-${s.id}`} className="block truncate font-medium">{s.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{s.batch}</span>
              </span>
              <fieldset aria-labelledby={`st-${s.id}`} className="grid w-full grid-cols-4 gap-1.5 sm:w-auto">
                <input type="hidden" name={`att-${s.id}`} value={picked[s.id] ?? ""} />
                {ATTENDANCE.map((a) => (
                  <label
                    key={a.key}
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-lg border border-input px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
                      PICKED[a.key],
                    )}
                  >
                    <input
                      type="radio"
                      name={`pick-${s.id}`}
                      value={a.key}
                      checked={picked[s.id] === a.key}
                      onChange={() => setPicked((p) => ({ ...p, [s.id]: a.key }))}
                      className="sr-only"
                    />
                    {a.label}
                  </label>
                ))}
              </fieldset>
            </li>
          ))}
        </ul>
      </FormCard>
    </form>
  );
}
