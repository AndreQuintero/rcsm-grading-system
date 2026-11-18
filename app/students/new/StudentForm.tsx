"use client";

import { useActionState } from "react";
import { STATUSES } from "@/lib/student";
import { updateStudent } from "../actions";
import { PhotoPicker } from "../PhotoPicker";
import { createStudent, type StudentFormState } from "./actions";

type Props = { studentId?: number; hasPhoto?: boolean; initial?: Record<string, string> };

// Registers a student, or edits one when studentId is given.
export function StudentForm({ studentId, hasPhoto = false, initial = {} }: Props) {
  const [state, action, pending] = useActionState(
    studentId ? updateStudent.bind(null, studentId) : createStudent,
    { values: initial } as StudentFormState,
  );
  const v = state.values ?? initial;
  const err = (k: string) => state.errors?.[k] && <p role="alert">{state.errors[k]}</p>;

  return (
    <form action={action}>
      {err("form")}
      <div className="grid-3">
        <div className="field">
          <label htmlFor="firstName" className="field-label">First name</label>
          <input id="firstName" name="firstName" defaultValue={v.firstName} required />
          {err("firstName")}
        </div>
        <div className="field">
          <label htmlFor="middleName" className="field-label">Middle name <span className="optional">(optional)</span></label>
          <input id="middleName" name="middleName" defaultValue={v.middleName} />
        </div>
        <div className="field">
          <label htmlFor="lastName" className="field-label">Last name</label>
          <input id="lastName" name="lastName" defaultValue={v.lastName} required />
          {err("lastName")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="dateOfBirth" className="field-label">Date of birth</label>
        <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} required />
        {err("dateOfBirth")}
      </div>

      <fieldset className="choice">
        <legend>Status</legend>
        {(Object.keys(STATUSES) as (keyof typeof STATUSES)[]).map((key) => (
          <label key={key} className="choice-option">
            <input
              type="radio"
              name="status"
              value={key}
              defaultChecked={v.status === key}
              required
            />
            {STATUSES[key]}
          </label>
        ))}
        {err("status")}
      </fieldset>

      <div className="field">
        <label htmlFor="enrollmentDate" className="field-label">Enrollment date</label>
        <input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={v.enrollmentDate} required />
        {err("enrollmentDate")}
      </div>

      <PhotoPicker existingUrl={studentId && hasPhoto ? `/students/${studentId}/photo` : null} />
      {err("photo")}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {studentId
          ? pending ? "Saving…" : "Save changes"
          : pending ? "Registering…" : "Register student"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
