"use client";

import { Layers, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bindBatchAction, unbindBatchAction } from "../../actions";

type Batch = { id: number; label: string; bound: boolean; students: number };

// The batches graded in this subject: remove one (its grades are kept) or add another of the semester's batches.
export function BatchBinder({ semesterId, subjectId, batches }: { semesterId: number; subjectId: number; batches: Batch[] }) {
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const bound = batches.filter((b) => b.bound);
  const free = batches.filter((b) => !b.bound);

  const add = () =>
    start(async () => {
      const r = await bindBatchAction(semesterId, subjectId, Number(pick));
      if (r.error) toast.error(r.error);
      else { toast.success("Batch added."); setPick(""); }
    });
  const remove = (b: Batch) =>
    start(async () => {
      await unbindBatchAction(semesterId, subjectId, b.id);
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
                onClick={() => remove(b)}
                aria-label={`Remove the ${b.label} from this subject`}
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
          <label htmlFor="add-batch" className="sr-only">Batch to add</label>
          <select
            id="add-batch"
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
        batches.length === 0
          ? <p className="text-sm text-muted-foreground">This semester has no batches yet. An admin adds them on the semester&apos;s page.</p>
          : <p className="text-sm text-muted-foreground">Every batch of this semester is added.</p>
      )}
    </div>
  );
}
