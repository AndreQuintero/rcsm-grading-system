"use client";

import { Trash2 } from "lucide-react";
import { useId, useRef } from "react";

// action is a bound server action, e.g. deleteTeacher.bind(null, id).
export function ConfirmDeleteButton({
  action,
  name,
  noun,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  noun: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className="icon-action icon-action-danger"
        aria-label={`Delete ${noun} ${name}`}
        title={`Delete ${noun}`}
        onClick={() => dialog.current?.showModal()}
      >
        <Trash2 size={17} aria-hidden="true" />
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby={titleId}>
        <form action={action} onSubmit={() => dialog.current?.close()}>
          <h2 id={titleId}>Delete {noun}?</h2>
          <p>
            This permanently removes <strong>{name}</strong>. It can&apos;t be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger">
              Delete
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
