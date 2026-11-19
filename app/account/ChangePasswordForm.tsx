"use client";

import { CheckCircle2, KeyRound, X } from "lucide-react";
import { useActionState, useState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrength } from "@/components/password-strength";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ChangePasswordState } from "@/lib/auth/account-shared";
import { LOGIN_PASSWORD_MAX, PASSWORD_MAX, PASSWORD_MIN, unmetRules } from "@/lib/auth/password-rules";
import { changePasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  // all controlled: React resets uncontrolled fields after every submit, which would empty them after an error
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const reset = () => { setCurrent(""); setPassword(""); setConfirm(""); };
  const [state, action, pending] = useActionState(async (prev: ChangePasswordState, formData: FormData) => {
    const r = await changePasswordAction(prev, formData);
    if (r.changed) {
      setOpen(false);
      reset();
    }
    return r;
  }, {} as ChangePasswordState);
  const ready = unmetRules(password).length === 0;
  const e = state.errors ?? {};

  return (
    <section aria-labelledby="password-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="password-heading" className="font-heading text-xl font-semibold">Reset password</h2>
          <p className="text-sm text-muted-foreground">Change the password you use to sign in.</p>
        </div>
        {!open && (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <KeyRound aria-hidden="true" />
            Reset password
          </Button>
        )}
      </div>

      {state.changed && !open && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white animate-in zoom-in-50 duration-500">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">New password confirmed</p>
            <p className="text-sm text-emerald-800">Your password was changed. Use it the next time you sign in; other devices were signed out.</p>
          </div>
        </div>
      )}

      {open ? (
        <form action={action} className="animate-in fade-in slide-in-from-top-2 duration-300">
          <FormCard
            footer={
              <>
                <Button type="submit" size="lg" disabled={pending || !ready}>
                  {pending ? "Saving…" : "Save new password"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setOpen(false); reset(); }}>
                  <X aria-hidden="true" />
                  Cancel
                </Button>
                {!ready && <p className="text-sm text-muted-foreground">Meet every requirement to save your new password.</p>}
              </>
            }
          >
            <FieldError message={e.form} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" maxLength={LOGIN_PASSWORD_MAX} required value={current} onChange={(ev) => setCurrent(ev.target.value)} aria-invalid={Boolean(e.currentPassword) || undefined} />
              <FieldError message={e.currentPassword} />
            </div>
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
                onChange={(ev) => setPassword(ev.target.value)}
                aria-invalid={Boolean(e.password) || undefined}
                aria-describedby="password-requirements"
              />
              <FieldError message={e.password} />
            </div>
            <div id="password-requirements">
              <PasswordStrength password={password} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" maxLength={PASSWORD_MAX} required value={confirm} onChange={(ev) => setConfirm(ev.target.value)} aria-invalid={Boolean(e.confirmPassword) || undefined} />
              <FieldError message={e.confirmPassword} />
            </div>
          </FormCard>
        </form>
      ) : null}
    </section>
  );
}
