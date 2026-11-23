"use client";

import { Fingerprint } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { biometricsAvailable, enrollThisDevice } from "./biometrics";

const OFFER_COOKIE = "rcsm_offer_biometrics"; // set by completeLogin after a password sign-in (lib/auth/login.ts)
const NOT_NOW_KEY = "rcsm-biometrics-not-now";

// After a password sign-in on a device that can check a fingerprint or face, offers once to turn on biometric
// sign-in here. "Not now" is remembered on this device; the account page can still turn it on.
export function EnableBiometricsPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!document.cookie.split("; ").includes(`${OFFER_COOKIE}=1`)) return;
    document.cookie = `${OFFER_COOKIE}=; Max-Age=0; path=/`;
    let declined = false;
    try {
      declined = localStorage.getItem(NOT_NOW_KEY) === "1";
    } catch {}
    if (!declined) biometricsAvailable().then((ok) => ok && setOpen(true));
  }, [pathname]);

  const notNow = () => {
    try {
      localStorage.setItem(NOT_NOW_KEY, "1");
    } catch {}
    setOpen(false);
  };
  const turnOn = () =>
    startTransition(async () => {
      const error = await enrollThisDevice();
      if (error) toast.error(error);
      else {
        toast.success("Biometric sign-in is on for this device.");
        setOpen(false);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <Fingerprint aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Sign in faster next time?</AlertDialogTitle>
          <AlertDialogDescription>
            Use your fingerprint or face to sign in on this device. Your fingerprint and face never leave the device; you
            can still sign in with your password, and turn this off on your account page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={notNow} disabled={pending}>Not now</AlertDialogCancel>
          <Button type="button" onClick={turnOn} disabled={pending}>
            <Fingerprint aria-hidden="true" />
            {pending ? "Waiting for your device…" : "Turn on"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
