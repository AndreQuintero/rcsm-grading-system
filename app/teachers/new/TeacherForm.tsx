"use client";

import { useActionState, useState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError, SuccessMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubjectMultiSelect } from "../../SubjectMultiSelect";
import { updateTeacher } from "../actions";
import { createTeacher, type TeacherFormState } from "./actions";

type Props = {
  teacherId?: number;
  initial?: Record<string, string>;
  subjectOptions: { id: number; name: string }[];
  initialSubjectIds?: number[];
};

export function TeacherForm({ teacherId, initial = {}, subjectOptions, initialSubjectIds = [] }: Props) {
  // Bumped after a successful registration to remount (clear) the subject picker.
  const [pickerKey, setPickerKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: TeacherFormState, formData: FormData) => {
    const r = teacherId ? await updateTeacher(teacherId, prev, formData) : await createTeacher(prev, formData);
    if (!teacherId && !r.errors) setPickerKey((k) => k + 1);
    return r;
  }, { values: initial });
  const v = state.values ?? initial;
  const e = state.errors ?? {};

  return (
    <form action={action}>
      <FormCard
        footer={
          <>
            <Button type="submit" size="lg" disabled={pending}>
              {teacherId
                ? pending ? "Saving…" : "Save changes"
                : pending ? "Registering…" : "Register teacher"}
            </Button>
            <SuccessMessage message={state.message} />
          </>
        }
      >
        <FieldError message={e.form} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={v.fullName} required aria-invalid={Boolean(e.fullName) || undefined} />
          <FieldError message={e.fullName} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} required aria-invalid={Boolean(e.dateOfBirth) || undefined} />
            <FieldError message={e.dateOfBirth} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={v.email} required aria-invalid={Boolean(e.email) || undefined} />
            <FieldError message={e.email} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SubjectMultiSelect
            key={pickerKey}
            label="Subjects taught"
            name="subjectIds"
            options={subjectOptions}
            defaultValue={initialSubjectIds}
          />
          <FieldError message={e.subjectIds} />
        </div>
      </FormCard>
    </form>
  );
}
