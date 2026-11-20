"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMENT_MAX, GRADE_MAX, GRADE_TYPES, gradeTotal, type GradeFormState, type Grades } from "@/lib/grading-shared";
import { cn } from "@/lib/utils";
import { saveGradesAction } from "../../../actions";

type Props = { semesterId: number; subjectId: number; studentId: number; grades: Grades; comment: string; saved: string | null };

// The 4 grades (blank = not given yet) and a comment. Controlled, so the live total and the inputs
// survive React's form reset after the action.
export function GradeForm({ semesterId, subjectId, studentId, grades, comment, saved }: Props) {
  const [v, setV] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(GRADE_TYPES.map((t) => [t.key, grades[t.key] === null ? "" : String(grades[t.key])])),
    comment,
  }));
  // after a save, back to the subject's students
  const savedRedirect = useSavedRedirect(`/teacher/gradings/${semesterId}/${subjectId}`);
  const [state, action, pending] = useActionState(async (prev: GradeFormState, fd: FormData) => {
    const r = await saveGradesAction(semesterId, subjectId, studentId, prev, fd);
    if (r.message) savedRedirect(r.message);
    else if (r.errors?.form) toast.error(r.errors.form);
    return r;
  }, {});
  const e = state.errors ?? {};
  // a value that isn't a whole 0–25 counts as not given in the live total
  const asGrade = (s: string) => (/^\d+$/.test(s.trim()) && Number(s) <= GRADE_MAX ? Number(s) : null);
  const { total, given } = gradeTotal(Object.fromEntries(GRADE_TYPES.map((t) => [t.key, asGrade(v[t.key])])));

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 rounded-2xl bg-sidebar px-6 py-5 text-white" aria-live="polite">
        <div>
          <p className="text-sm text-white/70">Total</p>
          <p className="font-heading text-5xl leading-none font-bold tabular-nums">
            {total}<span className="text-2xl text-white/60"> / 100</span>
          </p>
        </div>
        <p className="text-right text-sm text-white/70">{given} of 4 grades given</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {GRADE_TYPES.map((t) => (
          <div key={t.key} className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-4", e[t.key] && "border-destructive/50")}>
            <Label htmlFor={t.key}>{t.label}</Label>
            <div className="flex items-baseline gap-2">
              <Input
                id={t.key}
                name={t.key}
                type="number"
                inputMode="numeric"
                min={0}
                max={GRADE_MAX}
                step={1}
                placeholder="–"
                value={v[t.key]}
                onChange={(ev) => setV((x) => ({ ...x, [t.key]: ev.target.value }))}
                aria-invalid={Boolean(e[t.key]) || undefined}
                aria-describedby={`${t.key}-max`}
                className="h-11 w-24 text-lg font-medium tabular-nums"
              />
              <span id={`${t.key}-max`} className="text-sm text-muted-foreground">out of {GRADE_MAX}</span>
            </div>
            <FieldError message={e[t.key]} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="comment">Comment</Label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          maxLength={COMMENT_MAX}
          value={v.comment}
          onChange={(ev) => setV((x) => ({ ...x, comment: ev.target.value }))}
          placeholder="How is this student doing in this subject?"
          aria-invalid={Boolean(e.comment) || undefined}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <FieldError message={e.comment} />
      </div>

      <FieldError message={e.form} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{saved ?? "No grades saved yet."}</p>
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save grades"}</Button>
      </div>
    </form>
  );
}
