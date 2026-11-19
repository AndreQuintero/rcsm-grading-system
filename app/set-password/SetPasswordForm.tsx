"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrength } from "@/components/password-strength";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX, PASSWORD_MIN, unmetRules } from "@/lib/auth/password-rules";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPassword, {} as SetPasswordState);
  // controlled, so the checklist and bar follow every keystroke (the server checks the same rules again)
  const [password, setPasswordValue] = useState("");
  const ready = unmetRules(password).length === 0;
  const e = state.errors ?? {};
  return (
    <form action={action}>
      <FormCard
        footer={
          <>
            <Button type="submit" size="lg" disabled={pending || !ready}>
              {pending ? "Saving…" : "Set password"}
            </Button>
            {!ready && <p className="text-sm text-muted-foreground">Meet every requirement to set your password.</p>}
          </>
        }
      >
        {e.form && (
          <div className="flex flex-col gap-1">
            <FieldError message={e.form} />
            <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Go to the login page
            </Link>
          </div>
        )}
        <input type="hidden" name="token" value={token} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            required
            value={password}
            onChange={(ev) => setPasswordValue(ev.target.value)}
            aria-invalid={Boolean(e.password) || undefined}
            aria-describedby="password-requirements"
          />
          <FieldError message={e.password} />
        </div>
        <div id="password-requirements">
          <PasswordStrength password={password} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" maxLength={PASSWORD_MAX} required aria-invalid={Boolean(e.confirmPassword) || undefined} />
          <FieldError message={e.confirmPassword} />
        </div>
      </FormCard>
    </form>
  );
}
