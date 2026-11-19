"use client";

import { Check, Layers, TriangleAlert, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { GenericAvatar } from "@/components/generic-avatar";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AcademicSemesterFormState, TeacherSubjects } from "@/lib/academic-semester";
import { cn } from "@/lib/utils";
import { SubjectMultiSelect } from "../../SubjectMultiSelect";
import { updateAcademicSemesterAction } from "../actions";
import { createAcademicSemesterAction } from "./actions";

type Options = {
  batches: { id: number; label: string; students: number }[];
  teachers: { id: number; name: string; hasPhoto: boolean }[];
  subjects: { id: number; name: string }[];
};
type Props = { semesterId?: number; initial?: Record<string, string>; options: Options };

const SEMESTERS = [
  { value: "1", label: "1st semester" },
  { value: "2", label: "2nd semester" },
];

// Registers an academic semester, or edits one when semesterId is given.
export function AcademicSemesterForm({ semesterId, initial = {}, options }: Props) {
  const saved = useSavedRedirect("/academic-semesters");
  const [state, action, pending] = useActionState(async (prev: AcademicSemesterFormState, formData: FormData) => {
    const r = semesterId ? await updateAcademicSemesterAction(semesterId, prev, formData) : await createAcademicSemesterAction(prev, formData);
    if (!r.errors) saved(r.message);
    else if (r.errors.period)
      toast.error(semesterId ? "This academic semester can't be saved" : "This academic semester can't be registered", { description: r.errors.period, duration: 9000 });
    return r;
  }, { values: initial });
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  const batchIds = (v.batchIds ?? "").split(",").filter(Boolean).map(Number);
  const teachers: TeacherSubjects[] = v.teachers ? JSON.parse(v.teachers) : [];

  return (
    <form action={action}>
      <FormCard
        footer={
          <Button type="submit" size="lg" disabled={pending}>
            {semesterId ? (pending ? "Saving…" : "Save changes") : pending ? "Registering…" : "Register academic semester"}
          </Button>
        }
      >
        <FieldError message={e.form} />
        <div className="grid gap-6 sm:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Year</Label>
            <Input id="year" name="year" type="number" min={2000} max={2100} step={1} defaultValue={v.year} required aria-invalid={Boolean(e.year || e.period) || undefined} />
            <FieldError message={e.year} />
          </div>
          {/* native radios so React's form reset after saving keeps them in step with what is submitted */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium leading-none">Semester</legend>
            <div className="grid grid-cols-2 gap-2">
              {SEMESTERS.map((s) => (
                <label
                  key={s.value}
                  className={cn(
                    "flex h-8 cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
                    e.period && "has-checked:border-destructive has-checked:bg-destructive/5 has-checked:text-destructive",
                  )}
                >
                  <input type="radio" name="semester" value={s.value} defaultChecked={v.semester === s.value} required className="size-4 accent-primary" />
                  {s.label}
                </label>
              ))}
            </div>
            <FieldError message={e.semester} />
          </fieldset>
        </div>
        {e.period && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {e.period}
          </p>
        )}

        {/* keyed on the saved values so a returned state (error) rebuilds the pickers from what was submitted */}
        <BatchCards key={`b-${v.batchIds}`} batches={options.batches} selected={batchIds} />
        <TeacherRows key={`t-${v.teachers}`} options={options} initial={teachers} errors={e} />
      </FormCard>
    </form>
  );
}

function BatchCards({ batches, selected }: { batches: Options["batches"]; selected: number[] }) {
  const [count, setCount] = useState(() => batches.filter((b) => selected.includes(b.id)).length);
  return (
    <div role="group" aria-labelledby="batches-label" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id="batches-label" className="text-sm font-medium leading-none">Batches</span>
        <p className="text-sm text-muted-foreground" aria-live="polite">{count} of {batches.length} selected</p>
      </div>
      <p className="-mt-1 text-sm text-muted-foreground">The batches studying this semester. Their students take part through them.</p>
      {batches.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
          <p className="text-sm text-muted-foreground">No batches are registered yet.</p>
          <Button variant="outline" asChild><Link href="/batches/new">Register a batch</Link></Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {batches.map((b) => (
            <label
              key={b.id}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-[border-color,background-color,box-shadow] hover:border-primary/40 has-checked:border-primary has-checked:bg-accent/50 has-checked:shadow-[inset_0_0_0_1px_var(--primary)] has-focus-visible:ring-3 has-focus-visible:ring-ring/30"
            >
              <input
                type="checkbox"
                name="batchIds"
                value={b.id}
                defaultChecked={selected.includes(b.id)}
                className="sr-only"
                onChange={(ev) => setCount((c) => c + (ev.target.checked ? 1 : -1))}
              />
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium leading-snug">{b.label}</span>
                <span className="text-sm text-muted-foreground">{b.students} student{b.students === 1 ? "" : "s"}</span>
              </span>
              <span
                className="grid size-5 shrink-0 place-items-center self-start rounded-full border-2 border-input text-transparent transition-colors group-has-checked:border-primary group-has-checked:bg-primary group-has-checked:text-primary-foreground"
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Teachers of the semester, each with the subjects they teach in it. Posted as teacherIds + subjects-<teacherId>.
function TeacherRows({ options, initial, errors }: { options: Options; initial: TeacherSubjects[]; errors: Record<string, string> }) {
  const byId = new Map(options.teachers.map((t) => [t.id, t]));
  const [rows, setRows] = useState(() => initial.filter((r) => byId.has(r.teacherId)));
  const available = options.teachers.filter((t) => !rows.some((r) => r.teacherId === t.id));

  return (
    <div role="group" aria-labelledby="teachers-label" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id="teachers-label" className="text-sm font-medium leading-none">Teachers and subjects</span>
        <p className="text-sm text-muted-foreground" aria-live="polite">{rows.length} teacher{rows.length === 1 ? "" : "s"}</p>
      </div>
      <p className="-mt-1 text-sm text-muted-foreground">Add the teachers of this semester and choose the subjects each one teaches.</p>

      {options.teachers.length === 0 || options.subjects.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
          <p className="text-sm text-muted-foreground">
            {options.teachers.length === 0 ? "No teachers are registered yet." : "No subjects are registered yet."}
          </p>
          <Button variant="outline" asChild>
            {options.teachers.length === 0 ? <Link href="/teachers/new">Register a teacher</Link> : <Link href="/subjects/new">Register subjects</Link>}
          </Button>
        </div>
      ) : (
        <>
          {rows.map((r) => {
            const t = byId.get(r.teacherId)!;
            const err = errors[`teacher-${r.teacherId}`];
            return (
              <div
                key={r.teacherId}
                className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200", err && "border-destructive/50")}
              >
                <input type="hidden" name="teacherIds" value={r.teacherId} />
                <div className="flex items-center gap-3">
                  <span className="size-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
                    {t.hasPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private admin-only image; next/image would cache it
                      <img src={`/teachers/${t.id}/photo`} alt="" className="size-full object-cover" />
                    ) : (
                      <GenericAvatar />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${t.name} from this semester`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.teacherId !== r.teacherId))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <SubjectMultiSelect label={`Subjects ${t.name} teaches`} name={`subjects-${r.teacherId}`} options={options.subjects} defaultValue={r.subjectIds} />
                <FieldError message={err} />
              </div>
            );
          })}

          {available.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-teacher" className="sr-only">Add a teacher</Label>
              <div className="relative">
                <UserPlus className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                {/* no name: picking only adds a row, it is not submitted itself */}
                <select
                  id="add-teacher"
                  value=""
                  onChange={(ev) => {
                    const id = Number(ev.target.value);
                    if (id) setRows((rs) => [...rs, { teacherId: id, subjectIds: [] }]);
                  }}
                  className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-dashed border-input bg-transparent pr-3 pl-8 text-sm text-muted-foreground transition-colors outline-none hover:border-primary/50 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <option value="">Add a teacher…</option>
                  {available.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Every teacher is already in this semester.</p>
          )}
        </>
      )}
    </div>
  );
}
