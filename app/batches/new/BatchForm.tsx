"use client";

import { Check, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError, SuccessMessage } from "@/components/form-message";
import { GenericAvatar } from "@/components/generic-avatar";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBatchAction } from "../actions";
import { createBatchAction, type BatchFormState } from "./actions";

type Student = { id: number; name: string; status: string; age: number; hasPhoto: boolean };
type Props = { batchId?: number; initial?: Record<string, string>; students: Student[] };

const SEMESTERS = [
  { value: "1", label: "1st semester" },
  { value: "2", label: "2nd semester" },
];

// Registers a batch, or edits one when batchId is given.
export function BatchForm({ batchId, initial = {}, students }: Props) {
  // Bumped after a successful registration to remount (clear) the student cards and their count.
  const [cardsKey, setCardsKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: BatchFormState, formData: FormData) => {
    const r = batchId ? await updateBatchAction(batchId, prev, formData) : await createBatchAction(prev, formData);
    if (!batchId && !r.errors) setCardsKey((k) => k + 1);
    return r;
  }, { values: initial });
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  const selected = (v.studentIds ?? "").split(",").filter(Boolean).map(Number);

  return (
    <form action={action}>
      <FormCard
        footer={
          <>
            <Button type="submit" size="lg" disabled={pending}>
              {batchId
                ? pending ? "Saving…" : "Save changes"
                : pending ? "Registering…" : "Register batch"}
            </Button>
            <SuccessMessage message={state.message} />
          </>
        }
      >
        <FieldError message={e.form} />
        <div className="grid gap-6 sm:grid-cols-[1fr_1fr_2fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="number">Batch number</Label>
            <Input id="number" name="number" type="number" min={1} max={999} step={1} placeholder="e.g. 1" defaultValue={v.number} required aria-invalid={Boolean(e.number) || undefined} />
            <FieldError message={e.number} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Year</Label>
            <Input id="year" name="year" type="number" min={2000} max={2100} step={1} defaultValue={v.year} required aria-invalid={Boolean(e.year) || undefined} />
            <FieldError message={e.year} />
          </div>
          {/* native radios so React's form reset after saving keeps them in step with what is submitted */}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium leading-none">Semester</legend>
            <div className="grid grid-cols-2 gap-2">
              {SEMESTERS.map((s) => (
                <label
                  key={s.value}
                  className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/30"
                >
                  <input type="radio" name="semester" value={s.value} defaultChecked={v.semester === s.value} required className="size-4 accent-primary" />
                  {s.label}
                </label>
              ))}
            </div>
            <FieldError message={e.semester} />
          </fieldset>
        </div>

        <StudentCards key={cardsKey} students={students} selected={selected} />
        <FieldError message={e.studentIds} />
      </FormCard>
    </form>
  );
}

// Lower-case and strip accents, so "andre" finds "André".
const fold = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function StudentCards({ students, selected }: { students: Student[]; selected: number[] }) {
  const [count, setCount] = useState(() => students.filter((s) => selected.includes(s.id)).length);
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const visible = students.filter((s) => fold(s.name).includes(q)).length;

  return (
    <div role="group" aria-labelledby="students-label" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id="students-label" className="text-sm font-medium leading-none">Students</span>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {count} of {students.length} selected
        </p>
      </div>
      <p className="-mt-1 text-sm text-muted-foreground">Only students who are not inactive and not in another batch are listed.</p>

      {students.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
          <p className="text-sm text-muted-foreground">No students are available. Every student is either inactive or already in a batch.</p>
          <Button variant="outline" asChild>
            <Link href="/students/new">Register a student</Link>
          </Button>
        </div>
      ) : (
        <>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search students by name"
            placeholder="Search students by name"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            // Enter here filters only; it must not submit the batch form
            onKeyDown={(ev) => ev.key === "Enter" && ev.preventDefault()}
            className="pl-8"
          />
        </div>
        {visible === 0 && <p className="text-sm text-muted-foreground">No students match “{query.trim()}”.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <label
              key={s.id}
              // hidden, not removed: a selected student filtered out of view must still be submitted
              hidden={!fold(s.name).includes(q)}
              className="group relative flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-[border-color,background-color,box-shadow] hover:border-primary/40 has-checked:border-primary has-checked:bg-accent/50 has-checked:shadow-[inset_0_0_0_1px_var(--primary)] has-focus-visible:ring-3 has-focus-visible:ring-ring/30"
            >
              <input
                type="checkbox"
                name="studentIds"
                value={s.id}
                defaultChecked={selected.includes(s.id)}
                className="sr-only"
                onChange={(ev) => setCount((c) => c + (ev.target.checked ? 1 : -1))}
              />
              <span className="size-14 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-card">
                {s.hasPhoto ? (
                  <Image src={`/students/${s.id}/photo`} alt="" width={56} height={56} unoptimized className="size-full object-cover" />
                ) : (
                  <GenericAvatar />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span data-student-name className="line-clamp-2 font-medium leading-snug break-words">{s.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {s.age} years old
                  <StatusBadge status={s.status} />
                </span>
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
        </>
      )}
    </div>
  );
}
