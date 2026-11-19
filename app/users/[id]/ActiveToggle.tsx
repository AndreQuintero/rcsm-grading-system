"use client";

import { UserCheck, UserX } from "lucide-react";
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
import { setUserActive } from "../actions";

// Inactivate (blocks sign-in and ends their sessions) or reactivate, after a confirmation.
export function ActiveToggle({ id, username, inactive }: { id: number; username: string; inactive: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await setUserActive(id, inactive);
      setOpen(false);
      if (r.error) toast.error(r.error);
      else toast.success(r.message);
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {inactive ? (
          <Button size="lg"><UserCheck aria-hidden="true" />Reactivate user</Button>
        ) : (
          <Button size="lg" variant="destructive" className="bg-destructive text-white hover:bg-destructive/90">
            <UserX aria-hidden="true" />Inactivate user
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{inactive ? "Reactivate user?" : "Inactivate user?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {inactive ? (
              <><strong className="text-foreground">{username}</strong> will be able to sign in again.</>
            ) : (
              <><strong className="text-foreground">{username}</strong> will be signed out and can&apos;t sign in until
                reactivated. Their records are kept.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            onClick={run}
            disabled={pending}
            variant={inactive ? "default" : "destructive"}
            className={inactive ? undefined : "bg-destructive text-white hover:bg-destructive/90"}
          >
            {pending ? "Saving…" : inactive ? "Reactivate" : "Inactivate"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
