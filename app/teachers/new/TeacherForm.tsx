"use client";

import { useActionState } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubjectMultiSelect } from "../../SubjectMultiSelect";
import { updateTeacher } from "../actions";
import { createTeacher, type TeacherFormState } from "./actions";

type Props = {
  teacherId?: number;
  hasPhoto?: boolean;
  initial?: Record<string, string>;
  subjectOptions: { id: number; name: string }[];
  initialSubjectIds?: number[];
};

export function TeacherForm({ teacherId, hasPhoto = false, initial = {}, subjectOptions, initialSubjectIds = [] }: Props) {
  const saved = useSavedRedirect("/teachers");
  const [state, action, pending] = useActionState(async (prev: TeacherFormState, formData: FormData) => {
    const r = teacherId ? await updateTeacher(teacherId, prev, formData) : await createTeacher(prev, formData);
    if (!r.errors) saved(r.message);
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
          </>
        }
      >
        <FieldError message={e.form} />
        <PhotoPicker existingUrl={teacherId && hasPhoto ? `/teachers/${teacherId}/photo` : null} />
        <FieldError message={e.photo} />
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
