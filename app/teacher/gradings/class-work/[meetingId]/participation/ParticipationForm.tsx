"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMMENT_MAX, MARK_MAX, type ParticipationState } from "@/lib/class-work-shared";
import { cn } from "@/lib/utils";
import { saveParticipationAction } from "../../actions";

type Student = { id: number; name: string; hasPhoto: boolean; batch: string; score: number | null; comment: string | null };

// One row per student: a 0–100 participation score and an optional comment for the week. Controlled, so the typed
// values survive React's form reset after the action (and an error).
export function ParticipationForm({ meetingId, subjectId, students, back }: { meetingId: number; subjectId: number; students: Student[]; back: string }) {
  const saved = useSavedRedirect(back);
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.flatMap((s) => [[`part-${s.id}`, s.score === null ? "" : String(s.score)], [`note-${s.id}`, s.comment ?? ""]])),
  );
  const [state, action, pending] = useActionState(async (prev: ParticipationState, fd: FormData) => {
    const r = await saveParticipationAction(meetingId, subjectId, prev, fd);
    if (!r.errors) saved(r.message);
    return r;
  }, {});
  const e = state.errors ?? {};
  const set = (k: string) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: ev.target.value }));

  // live class average over the valid scores typed so far
  const typed = students.map((s) => v[`part-${s.id}`].trim()).filter((x) => /^\d+$/.test(x) && Number(x) <= MARK_MAX).map(Number);
  const avg = typed.length ? Math.round((typed.reduce((a, b) => a + b, 0) / typed.length) * 10) / 10 : null;

  return (
    <form action={action}>
      <FormCard footer={<Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save participation"}</Button>}>
        {Object.keys(e).length > 0 && <FieldError message="Some scores or comments need fixing below." />}
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-sidebar px-6 py-5 text-white" aria-live="polite">
          <div>
            <p className="text-sm text-white/70">Class average</p>
            <p className="font-heading text-5xl leading-none font-bold tabular-nums">{avg ?? "–"}<span className="text-2xl text-white/60"> / {MARK_MAX}</span></p>
          </div>
          <p className="text-sm text-white/70">{typed.length} of {students.length} student{students.length === 1 ? "" : "s"} scored</p>
        </div>
        <p className="text-sm text-muted-foreground">Scores and comments are optional: leave them empty and add them later.</p>
        <ul className="flex flex-col divide-y divide-border/70 rounded-2xl border border-border/70">
          {students.map((s) => {
            const part = `part-${s.id}`, note = `note-${s.id}`;
            return (
              <li key={s.id} className={cn("flex flex-col gap-3 px-4 py-4", (e[part] || e[note]) && "bg-destructive/5")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <label htmlFor={part} className="block truncate font-medium">{s.name}</label>
                    <span className="block truncate text-sm text-muted-foreground">{s.batch}</span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <Input
                      id={part}
                      name={part}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MARK_MAX}
                      step={1}
                      placeholder="–"
                      value={v[part]}
                      onChange={set(part)}
                      aria-invalid={Boolean(e[part]) || undefined}
                      className="h-10 w-20 text-right text-base font-medium tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">/ {MARK_MAX}</span>
                  </span>
                </div>
                <FieldError message={e[part]} />
                <label htmlFor={note} className="sr-only">Comment on {s.name}&apos;s participation</label>
                <textarea
                  id={note}
                  name={note}
                  rows={2}
                  maxLength={COMMENT_MAX}
                  placeholder="Comment on this week's participation (optional)"
                  value={v[note]}
                  onChange={set(note)}
                  aria-invalid={Boolean(e[note]) || undefined}
                  className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <FieldError message={e[note]} />
              </li>
            );
          })}
        </ul>
      </FormCard>
    </form>
  );
}
