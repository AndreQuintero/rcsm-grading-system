"use client";

import { useActionState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUSES } from "@/lib/student";
import { updateStudent } from "../actions";
import { PhotoPicker } from "../PhotoPicker";
import { createStudent, type StudentFormState } from "./actions";

type Props = { studentId?: number; hasPhoto?: boolean; initial?: Record<string, string> };

// Registers a student, or edits one when studentId is given.
export function StudentForm({ studentId, hasPhoto = false, initial = {} }: Props) {
  const saved = useSavedRedirect("/students");
  const [state, action, pending] = useActionState(async (prev: StudentFormState, formData: FormData) => {
    const r = studentId ? await updateStudent(studentId, prev, formData) : await createStudent(prev, formData);
    if (!r.errors) saved(r.message);
    return r;
  }, { values: initial } as StudentFormState);
  const v = state.values ?? initial;
  const e = state.errors ?? {};
  const invalid = (k: string) => Boolean(e[k]) || undefined;

  return (
    <form action={action}>
      <FormCard
        footer={
          <>
            <Button type="submit" size="lg" disabled={pending}>
              {studentId
                ? pending ? "Saving…" : "Save changes"
                : pending ? "Registering…" : "Register student"}
            </Button>
          </>
        }
      >
        <FieldError message={e.form} />
        <PhotoPicker existingUrl={studentId && hasPhoto ? `/students/${studentId}/photo` : null} />
        <FieldError message={e.photo} />

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" defaultValue={v.firstName} required aria-invalid={invalid("firstName")} />
            <FieldError message={e.firstName} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="middleName">
              Middle name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="middleName" name="middleName" defaultValue={v.middleName} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" defaultValue={v.lastName} required aria-invalid={invalid("lastName")} />
            <FieldError message={e.lastName} />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} required aria-invalid={invalid("dateOfBirth")} />
            <FieldError message={e.dateOfBirth} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="enrollmentDate">Enrollment date</Label>
            <Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={v.enrollmentDate} required aria-invalid={invalid("enrollmentDate")} />
            <FieldError message={e.enrollmentDate} />
          </div>
        </div>

        {/* native radios so React's form reset after saving keeps them in step with what is submitted */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium leading-none">Status</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(STATUSES) as (keyof typeof STATUSES)[]).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/30"
              >
                <input
                  type="radio"
                  name="status"
                  value={key}
                  defaultChecked={v.status === key}
                  required
                  className="size-4 accent-primary"
                />
                {STATUSES[key]}
              </label>
            ))}
          </div>
          <FieldError message={e.status} />
        </fieldset>
      </FormCard>
    </form>
  );
}
