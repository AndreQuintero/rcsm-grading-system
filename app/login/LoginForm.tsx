"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitEmail, submitPassword, type LoginState } from "./actions";

// Two steps in one form state: the email first, then the password with the email carried in a hidden field
// (the server re-validates it). "Use another email" goes back without a server call.
export function LoginForm({ next, passwordSet }: { next: string; passwordSet: boolean }) {
  const [state, action, pending] = useActionState(async (prev: LoginState, formData: FormData) => {
    if (formData.get("intent") === "restart") return { step: "email" } as LoginState;
    return prev.step === "password" ? submitPassword(prev, formData) : submitEmail(prev, formData);
  }, { step: "email" } as LoginState);

  return (
    <Card className="max-w-md [--card-spacing:--spacing(6)]">
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          {passwordSet && state.step === "email" && (
            <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              Your password is set. Sign in with your email and new password.
            </p>
          )}
          {state.message && (
            <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
              {state.message}
            </p>
          )}
          <input type="hidden" name="next" value={next} />

          {state.step === "email" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" maxLength={254} required autoFocus aria-invalid={Boolean(state.error) || undefined} />
              <FieldError message={state.error} />
            </div>
          ) : (
            <>
              <input type="hidden" name="email" value={state.email ?? ""} />
              {/* lets password managers pair the saved password with the email */}
              <input type="email" autoComplete="username" value={state.email ?? ""} readOnly hidden />
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{state.email}</span>
                <Button type="submit" name="intent" value="restart" variant="link" size="sm" formNoValidate className="h-auto px-0">
                  Use another email
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required autoFocus aria-invalid={Boolean(state.error) || undefined} />
                <FieldError message={state.error} />
              </div>
            </>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            {state.step === "email" ? (pending ? "Checking…" : "Continue") : pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
