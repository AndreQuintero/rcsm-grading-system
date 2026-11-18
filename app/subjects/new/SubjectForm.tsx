"use client";

import { useRef, useState, useTransition } from "react";
import { createSubjects, type SubjectFormState } from "./actions";

type Row = { id: number; value: string };

export function SubjectForm() {
  const [rows, setRows] = useState<Row[]>([{ id: 0, value: "" }]);
  const nextId = useRef(1);
  const [result, setResult] = useState<SubjectFormState>({});
  const [pending, startTransition] = useTransition();

  const addRow = () => {
    const id = nextId.current++;
    setRows((rs) => [...rs, { id, value: "" }]);
  };
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const editRow = (id: number, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value } : r)));

  const submit = () =>
    startTransition(async () => {
      const r = await createSubjects(rows.map((row) => row.value));
      setResult(r);
      // keep the inputs on error so nothing is lost; start over after a successful insert
      if (!r.errors) setRows([{ id: nextId.current++, value: "" }]);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {rows.map((row, i) => (
        <div className="subject-row" key={row.id}>
          <input
            aria-label={`Subject ${i + 1}`}
            placeholder="Subject name"
            value={row.value}
            onChange={(e) => editRow(row.id, e.target.value)}
          />
          <button type="button" className="icon-btn" aria-label={`Remove subject ${i + 1}`} onClick={() => removeRow(row.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
            </svg>
          </button>
        </div>
      ))}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={addRow}>
          + Add subject
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Registering…" : "Register subjects"}
        </button>
      </div>

      {result.errors && <p role="alert">{result.errors}</p>}
      {result.message && <p role="status">{result.message}</p>}
    </form>
  );
}
