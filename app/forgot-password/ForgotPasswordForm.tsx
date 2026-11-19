"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as ForgotState);
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent>
        {state.sent ? (
          <div className="flex flex-col gap-5">
            <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
              If this email is registered, we&apos;ve sent a link to it to choose a new password. The link works for 60 minutes.
            </p>
            <Button asChild size="lg">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" maxLength={254} required autoFocus aria-invalid={Boolean(state.error) || undefined} />
              <FieldError message={state.error} />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
            <Link href="/login" className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
