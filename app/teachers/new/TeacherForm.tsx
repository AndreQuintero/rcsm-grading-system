"use client";

import { useActionState } from "react";
import { updateTeacher } from "../actions";
import { createTeacher } from "./actions";

type Props = { teacherId?: number; initial?: Record<string, string> };

export function TeacherForm({ teacherId, initial = {} }: Props) {
  const [state, action, pending] = useActionState(
    teacherId ? updateTeacher.bind(null, teacherId) : createTeacher,
    { values: initial },
  );
  const v = state.values ?? initial;
  const err = (k: string) => state.errors?.[k] && <p role="alert">{state.errors[k]}</p>;

  return (
    <form action={action}>
      {err("form")}
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
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {teacherId
          ? pending ? "Saving…" : "Save changes"
          : pending ? "Registering…" : "Register teacher"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
