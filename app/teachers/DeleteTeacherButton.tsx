"use client";

import { useId, useRef } from "react";
import { deleteTeacher } from "./actions";

export function DeleteTeacherButton({ id, name }: { id: number; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={() => dialog.current?.showModal()}>
        Delete
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby={titleId}>
        <form action={deleteTeacher.bind(null, id)} onSubmit={() => dialog.current?.close()}>
          <h2 id={titleId}>Delete teacher?</h2>
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
