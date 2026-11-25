"use client";

import { Layers, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { assignBatchAction, unassignBatchAction } from "./actions";

type Batch = { id: number; label: string; students: number };

// The batches graded in one subject of the semester: remove one (its grades are kept) or add another of the semester's batches.
export function SubjectBatchBinder({ semesterId, subjectId, subject, batches, boundIds }: {
  semesterId: number; subjectId: number; subject: string; batches: Batch[]; boundIds: number[];
}) {
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [confirm, setConfirm] = useState<Batch | null>(null);
  const bound = batches.filter((b) => boundIds.includes(b.id));
  const free = batches.filter((b) => !boundIds.includes(b.id));

  const add = () =>
    start(async () => {
      const r = await assignBatchAction(semesterId, subjectId, Number(pick));
      if (r.error) toast.error(r.error);
      else { toast.success("Batch added."); setPick(""); }
    });
  const remove = (b: Batch) =>
    start(async () => {
      await unassignBatchAction(semesterId, subjectId, b.id);
      setConfirm(null);
      toast.success(`Removed the ${b.label}. Its students' grades are kept.`);
    });

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {bound.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {bound.map((b) => (
            <li key={b.id} className="flex items-center gap-2 rounded-full bg-accent py-1.5 pr-1.5 pl-3 text-sm font-medium text-accent-foreground">
              <Layers className="size-4" aria-hidden="true" />
              {b.label}
              <span className="text-accent-foreground/70">({b.students})</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(b)}
                aria-label={`Remove the ${b.label} from ${subject}`}
                className="grid size-6 place-items-center rounded-full outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {free.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`add-batch-${subjectId}`} className="sr-only">Batch to add to {subject}</label>
          <select
            id={`add-batch-${subjectId}`}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-9 flex-1 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">Choose a batch of this semester…</option>
            {free.map((b) => (
              <option key={b.id} value={b.id}>{b.label} ({b.students} student{b.students === 1 ? "" : "s"})</option>
            ))}
          </select>
          <Button type="button" onClick={add} disabled={!pick || pending}>
            <Plus aria-hidden="true" />
            {pending ? "Saving…" : "Add batch"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Every batch of this semester is added.</p>
      )}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && !pending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove batch?</AlertDialogTitle>
            <AlertDialogDescription>
              The students of the <strong className="text-foreground">{confirm?.label}</strong> will no longer be listed in
              <strong className="text-foreground">{subject}</strong> for its teachers. Their grades are kept and come back if
              you add the batch again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={() => confirm && remove(confirm)}
            >
              {pending ? "Removing…" : "Remove batch"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
