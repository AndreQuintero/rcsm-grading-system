"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { FieldError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { biometricsAvailable, cancelled } from "../biometrics";
import { finishPasskeyLogin, startPasskeyLogin } from "./passkey-actions";

// Shown only when this browser has a passkey enrolled (the server checks the device cookie) and the device still
// offers its fingerprint/face check. The password form above stays available either way.
export function BiometricButton({ next }: { next: string }) {
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    biometricsAvailable().then(setAvailable);
  }, []);
  if (!available) return null;

  const signIn = () =>
    startTransition(async () => {
      setError(undefined);
      const start = await startPasskeyLogin();
      if (start.error || !start.options) return setError(start.error);
      let response;
      try {
        response = await startAuthentication({ optionsJSON: start.options });
      } catch (e) {
        return setError(cancelled(e) ? "The fingerprint or face check was cancelled." : "This device couldn't check your fingerprint or face.");
      }
      // redirects on success
      setError((await finishPasskeyLogin(response, next)).error);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" size="lg" onClick={signIn} disabled={pending}>
        <Fingerprint aria-hidden="true" />
        {pending ? "Waiting for your fingerprint or face…" : "Sign in with biometrics"}
      </Button>
      <FieldError message={error} />
    </div>
  );
}
