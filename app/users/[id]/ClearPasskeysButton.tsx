"use client";

import { Fingerprint } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { clearUserPasskeys } from "../actions";

// Removes every device where the user signs in with a fingerprint or face, after a confirmation.
export function ClearPasskeysButton({ id, username, count }: { id: number; username: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await clearUserPasskeys(id);
      setOpen(false);
      if (r.error) toast.error(r.error);
      else toast.success(r.message);
    });
  const devices = `${count} device${count === 1 ? "" : "s"}`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="lg" variant="outline"><Fingerprint aria-hidden="true" />Remove biometric devices</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove biometric devices?</AlertDialogTitle>
          <AlertDialogDescription>
            Biometric sign-in will be turned off on all {devices} of <strong className="text-foreground">{username}</strong>.
            They keep their password and can turn it on again after signing in with it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={pending}>Cancel</AlertDialogCancel>
          <Button onClick={run} disabled={pending} variant="destructive" className="bg-destructive text-white hover:bg-destructive/90">
            {pending ? "Removing…" : "Remove all"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
