"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { createStudent, type StudentFormState } from "./actions";
import { STATUSES, needsEnrollmentDate } from "@/lib/student";

export function StudentForm() {
  const [state, action, pending] = useActionState(createStudent, { values: {} } as StudentFormState);
  const v = state.values ?? {};
  const [status, setStatus] = useState(v.status ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const err = (k: string) => state.errors?.[k] && <p role="alert">{state.errors[k]}</p>;

  return (
    <form action={action}>
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
              onChange={() => setStatus(key)}
            />
            {STATUSES[key]}
          </label>
        ))}
        {err("status")}
      </fieldset>

      {needsEnrollmentDate(status) && (
        <div className="field">
          <label htmlFor="enrollmentDate" className="field-label">Enrollment date</label>
          <input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={v.enrollmentDate} required />
          {err("enrollmentDate")}
        </div>
      )}

      <div className="field">
        <label htmlFor="photo" className="field-label">Photo <span className="optional">(optional, JPEG, PNG or WebP, up to 2 MB)</span></label>
        <div className="photo-row">
          {preview && <Image className="photo-preview" src={preview} alt="Selected photo preview" width={96} height={96} unoptimized />}
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </div>
        {err("photo")}
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Registering…" : "Register student"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
