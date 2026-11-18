"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { updateSubject } from "../actions";
import { createSubjects, type SubjectFormState } from "./actions";

type Row = { id: number; value: string };

// Without subjectId it registers many subjects; with it, it edits that single subject.
export function SubjectForm({ subjectId, initialName = "" }: { subjectId?: number; initialName?: string }) {
  const [rows, setRows] = useState<Row[]>([{ id: 0, value: initialName }]);
  const nextId = useRef(1);
  const [result, setResult] = useState<SubjectFormState>({});
  const [pending, startTransition] = useTransition();
  const editing = subjectId !== undefined;

  const addRow = () => {
    const id = nextId.current++;
    setRows((rs) => [...rs, { id, value: "" }]);
  };
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const editRow = (id: number, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value } : r)));

  const submit = () =>
    startTransition(async () => {
      if (editing) {
        setResult(await updateSubject(subjectId, rows[0].value));
        return;
      }
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
          {!editing && (
            <button type="button" className="icon-btn" aria-label={`Remove subject ${i + 1}`} onClick={() => removeRow(row.id)}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}

      <div className="form-actions">
        {!editing && (
          <button type="button" className="btn btn-ghost" onClick={addRow}>
            + Add subject
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {editing
            ? pending ? "Saving…" : "Save changes"
            : pending ? "Registering…" : "Register subjects"}
        </button>
      </div>

      {result.errors && <p role="alert">{result.errors}</p>}
      {result.message && <p role="status">{result.message}</p>}
    </form>
  );
}
