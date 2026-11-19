"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setPassword, {} as SetPasswordState);
  const e = state.errors ?? {};
  return (
    <form action={action}>
      <FormCard
        footer={
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Set password"}
          </Button>
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
        <p className="text-sm text-muted-foreground">Use 12 to 128 characters. A long phrase is easy to remember and hard to guess.</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-invalid={Boolean(e.password) || undefined} />
            <FieldError message={e.password} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} required aria-invalid={Boolean(e.confirmPassword) || undefined} />
            <FieldError message={e.confirmPassword} />
          </div>
        </div>
      </FormCard>
    </form>
  );
}
