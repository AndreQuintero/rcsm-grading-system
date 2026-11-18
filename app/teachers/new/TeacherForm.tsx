"use client";

import { useActionState } from "react";
import { createTeacher, type TeacherFormState } from "./actions";

const initial: TeacherFormState = {};

export function TeacherForm() {
  const [state, action, pending] = useActionState(createTeacher, initial);
  const v = state.values ?? {};
  const err = (k: string) => state.errors?.[k] && <p role="alert">{state.errors[k]}</p>;

  return (
    <form action={action}>
      <p>
        <label>
          Full name
          <input name="fullName" defaultValue={v.fullName} required />
        </label>
        {err("fullName")}
      </p>
      <p>
        <label>
          Date of birth
          <input name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} required />
        </label>
        {err("dateOfBirth")}
      </p>
      <p>
        <label>
          Email
          <input name="email" type="email" defaultValue={v.email} required />
        </label>
        {err("email")}
      </p>
      <p>
        <label>
          Subjects taught (one per line)
          <textarea name="subjects" rows={5} defaultValue={v.subjects} required />
        </label>
        {err("subjects")}
      </p>
      <button type="submit" disabled={pending}>
        {pending ? "Registering…" : "Register teacher"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
