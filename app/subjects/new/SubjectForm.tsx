"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const saved = useSavedRedirect("/subjects");

  const addRow = () => {
    const id = nextId.current++;
    setRows((rs) => [...rs, { id, value: "" }]);
  };
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const editRow = (id: number, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value } : r)));

  const submit = () =>
    startTransition(async () => {
      const r = editing ? await updateSubject(subjectId, rows[0].value) : await createSubjects(rows.map((row) => row.value));
      // on error the inputs stay as typed so nothing is lost
      if (r.errors) setResult(r);
      else saved(r.message);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <FormCard
        footer={
          <>
            <Button type="submit" size="lg" disabled={pending}>
              {editing
                ? pending ? "Saving…" : "Save changes"
                : pending ? "Registering…" : "Register subjects"}
            </Button>
            <FieldError message={result.errors} />
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="subject-0">{editing ? "Subject name" : "Subject names"}</Label>
          <ul className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <li className="flex gap-2" key={row.id}>
                <Input
                  id={i === 0 ? "subject-0" : undefined}
                  aria-label={`Subject ${i + 1}`}
                  placeholder="Subject name"
                  value={row.value}
                  onChange={(e) => editRow(row.id, e.target.value)}
                />
                {!editing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove subject ${i + 1}`}
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
        {!editing && (
          <Button type="button" variant="outline" className="self-start" onClick={addRow}>
            <Plus aria-hidden="true" />
            Add subject
          </Button>
        )}
      </FormCard>
    </form>
  );
}
