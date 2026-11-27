"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentStudent } from "@/lib/assignment";
import { ASSIGNMENT_COMMENT_MAX, ASSIGNMENT_MAX_SCORE, ASSIGNMENT_NAME_MAX, scoreAverage, type AssignmentFormState } from "@/lib/assignment-shared";
import { cn } from "@/lib/utils";
import { SearchSelect } from "@/app/SearchSelect";
import { createAssignmentAction, updateAssignmentAction } from "../../../actions";

type Props = {
  semesterId: number;
  subjectId: number;
  assignmentId?: number;
  students: AssignmentStudent[];
  initial: Record<string, string>;
  // the teacher's own weekly meetings; `fixedMeeting` = a meeting that can't be changed here, with why (`note`): the
  // weekly meeting the teacher came from, or another teacher's meeting this assignment is in
  meetings: { value: string; label: string }[];
  fixedMeeting?: { id: number; label: string; note: string };
  returnTo?: string; // where a save goes back to (default: the subject's assignment list)
};

// Registers an assignment, or edits one when assignmentId is given. Controlled, so the live average and the inputs
// survive React's form reset after the action.
export function AssignmentForm({ semesterId, subjectId, assignmentId, students, initial, meetings, fixedMeeting, returnTo }: Props) {
  const list = returnTo ?? `/teacher/assignments/${semesterId}/${subjectId}`;
  const savedRedirect = useSavedRedirect(list);
  const [v, setV] = useState<Record<string, string>>(initial);
  const [state, action, pending] = useActionState(async (prev: AssignmentFormState, fd: FormData) => {
    const r = assignmentId
      ? await updateAssignmentAction(semesterId, subjectId, assignmentId, prev, fd)
      : await createAssignmentAction(semesterId, subjectId, prev, fd);
    if (!r.errors) savedRedirect(r.message);
    return r;
  }, {});
  const e = state.errors ?? {};
  const set = (k: string) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: ev.target.value }));

  // live class average over the valid scores typed so far
  const max = /^\d+$/.test(v.maxScore ?? "") && Number(v.maxScore) >= 1 ? Number(v.maxScore) : null;
  const typed = students.map((s) => {
    const raw = (v[`score-${s.id}`] ?? "").trim();
    return /^\d+$/.test(raw) && (max === null || Number(raw) <= max) ? Number(raw) : null;
  });
  const { avg, n } = scoreAverage(typed);
  const pct = avg !== null && max ? Math.round((avg / max) * 100) : null;

  return (
    <form action={action}>
      <FormCard
        footer={
          <Button type="submit" size="lg" disabled={pending}>
            {assignmentId ? (pending ? "Saving…" : "Save changes") : pending ? "Registering…" : "Register assignment"}
          </Button>
        }
      >
        <FieldError message={e.form} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="meetingId">Weekly meeting</Label>
          {fixedMeeting ? (
            <>
              <input type="hidden" name="meetingId" value={fixedMeeting.id} />
              <p id="meetingId" className="text-sm">{fixedMeeting.label}</p>
              <p className="text-sm text-muted-foreground">{fixedMeeting.note}</p>
            </>
          ) : (
            <SearchSelect id="meetingId" name="meetingId" options={meetings} defaultValue={initial.meetingId ?? ""} placeholder="Search your weekly meetings…" />
          )}
          <FieldError message={e.meetingId} />
        </div>
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Assignment name</Label>
            <Input id="name" name="name" value={v.name ?? ""} onChange={set("name")} maxLength={ASSIGNMENT_NAME_MAX} placeholder="e.g. Essay on grace" required aria-invalid={Boolean(e.name) || undefined} />
            <FieldError message={e.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dueOn">Date</Label>
            <Input id="dueOn" name="dueOn" type="date" value={v.dueOn ?? ""} onChange={set("dueOn")} min="2000-01-01" max="2100-12-31" required aria-invalid={Boolean(e.dueOn) || undefined} />
            <FieldError message={e.dueOn} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxScore">Maximum points</Label>
            <Input id="maxScore" name="maxScore" type="number" inputMode="numeric" min={1} max={ASSIGNMENT_MAX_SCORE} step={1} value={v.maxScore ?? ""} onChange={set("maxScore")} placeholder="e.g. 20" required aria-invalid={Boolean(e.maxScore) || undefined} />
            <FieldError message={e.maxScore} />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-sidebar px-6 py-5 text-white" aria-live="polite">
          <div>
            <p className="text-sm text-white/70">Class average</p>
            <p className="font-heading text-5xl leading-none font-bold tabular-nums">
              {avg ?? "–"}<span className="text-2xl text-white/60"> / {max ?? "–"}</span>
            </p>
          </div>
          <div className="text-right text-sm text-white/70">
            {pct !== null && <p className="font-heading text-2xl font-bold text-white tabular-nums">{pct}%</p>}
            <p>{n} of {students.length} student{students.length === 1 ? "" : "s"} scored</p>
          </div>
        </div>

        <section aria-labelledby="students" className="flex flex-col gap-3">
          <div>
            <h2 id="students" className="font-heading text-xl font-bold">Students</h2>
            <p className="text-sm text-muted-foreground">Scores and comments are optional: leave them empty and add them later by editing the assignment.</p>
          </div>
          <ul className="flex flex-col divide-y divide-border/70 rounded-2xl border border-border/70">
            {students.map((s) => {
              const key = `score-${s.id}`, note = `comment-${s.id}`;
              return (
                <li key={s.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", (e[key] || e[note]) && "bg-destructive/5")}>
                  <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <label htmlFor={key} className="block truncate font-medium">{s.name}</label>
                    <span className="block truncate text-sm text-muted-foreground">{s.batch}</span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <Input
                      id={key}
                      name={key}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={max ?? ASSIGNMENT_MAX_SCORE}
                      step={1}
                      placeholder="–"
                      value={v[key] ?? ""}
                      onChange={set(key)}
                      aria-invalid={Boolean(e[key]) || undefined}
                      aria-describedby={`${key}-max`}
                      className="h-10 w-20 text-right text-base font-medium tabular-nums"
                    />
                    <span id={`${key}-max`} className="w-12 text-sm text-muted-foreground">/ {max ?? "–"}</span>
                  </span>
                  {e[key] && <span className="basis-full"><FieldError message={e[key]} /></span>}
                  <label htmlFor={note} className="sr-only">Comment for {s.name} (optional)</label>
                  <textarea
                    id={note}
                    name={note}
                    rows={1}
                    maxLength={ASSIGNMENT_COMMENT_MAX}
                    placeholder="Comment (optional)"
                    value={v[note] ?? ""}
                    onChange={set(note)}
                    aria-invalid={Boolean(e[note]) || undefined}
                    className="basis-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                  {e[note] && <span className="basis-full"><FieldError message={e[note]} /></span>}
                </li>
              );
            })}
          </ul>
        </section>
      </FormCard>
    </form>
  );
}
