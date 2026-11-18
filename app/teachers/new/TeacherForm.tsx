"use client";

import { useActionState, useState } from "react";
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
  const err = (k: string) => state.errors?.[k] && <p role="alert">{state.errors[k]}</p>;

  return (
    <form action={action}>
      {err("form")}
      <div className="field">
        <label htmlFor="fullName" className="field-label">Full name</label>
        <input id="fullName" name="fullName" defaultValue={v.fullName} required />
        {err("fullName")}
      </div>
      <div className="field">
        <label htmlFor="dateOfBirth" className="field-label">Date of birth</label>
        <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} required />
        {err("dateOfBirth")}
      </div>
      <div className="field">
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" defaultValue={v.email} required />
        {err("email")}
      </div>
      <div className="field">
        <SubjectMultiSelect
          key={pickerKey}
          label="Subjects taught"
          name="subjectIds"
          options={subjectOptions}
          defaultValue={initialSubjectIds}
        />
        {err("subjectIds")}
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {teacherId
          ? pending ? "Saving…" : "Save changes"
          : pending ? "Registering…" : "Register teacher"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
