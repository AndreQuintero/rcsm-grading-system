"use client";

import { Fingerprint } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/app/ConfirmDeleteButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Passkey } from "@/lib/auth/passkey";
import { formatDate } from "@/lib/dates";
import { biometricsAvailable, enrollThisDevice } from "../biometrics";
import { removePasskey } from "./passkey-actions";

// The devices where this user signs in with a fingerprint or face, with Remove, and "Turn on for this device"
// when this device can check one and isn't enrolled yet. canEnroll = this session started with the password (the
// "password first on each device" rule).
export function Passkeys({ passkeys, canEnroll }: { passkeys: Passkey[]; canEnroll: boolean }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    biometricsAvailable().then(setAvailable);
  }, []);
  const here = passkeys.some((p) => p.thisDevice);
  const turnOn = () =>
    startTransition(async () => {
      const error = await enrollThisDevice();
      if (error) toast.error(error);
      else toast.success("Biometric sign-in is on for this device.");
    });

  return (
    <section aria-labelledby="biometrics-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="biometrics-heading" className="font-heading text-xl font-semibold">Biometric sign-in</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with your fingerprint or face on devices where you turned it on. Your password always works too.
          </p>
        </div>
        {available && !here && canEnroll && (
          <Button type="button" variant="outline" onClick={turnOn} disabled={pending}>
            <Fingerprint aria-hidden="true" />
            {pending ? "Waiting for your device…" : "Turn on for this device"}
          </Button>
        )}
      </div>
      {available && !here && !canEnroll && (
        <p className="text-sm text-muted-foreground">Sign in with your password on this device to turn it on here.</p>
      )}
      {available === false && !here && (
        <p className="text-sm text-muted-foreground">This device or browser can&apos;t check a fingerprint or face.</p>
      )}
      {passkeys.length > 0 && (
        <Card className="py-2">
          <CardContent className="px-2">
            <ul className="divide-y divide-border">
              {passkeys.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Fingerprint className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {p.label}
                      {p.thisDevice && <Badge variant="secondary">This device</Badge>}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Added {formatDate(p.created)} · {p.lastUsed ? `last used ${formatDate(p.lastUsed)}` : "not used yet"}
                    </span>
                  </span>
                  <ConfirmDeleteButton
                    action={removePasskey.bind(null, p.id)}
                    name={p.label}
                    noun="biometric sign-in"
                    note="You can sign in there with your password and turn it on again."
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
