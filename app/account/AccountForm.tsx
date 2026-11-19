"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { PhotoPicker } from "@/components/photo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USERNAME_MAX, type AccountState } from "@/lib/auth/account-shared";
import { formatDate } from "@/lib/dates";
import { updateAccountAction } from "./actions";

type Props = { username: string; email: string; created: string; photoUrl: string | null };

export function AccountForm({ username, email, created, photoUrl }: Props) {
  const [state, action, pending] = useActionState(async (prev: AccountState, formData: FormData) => {
    const r = await updateAccountAction(prev, formData);
    if (r.message) toast.success(r.message);
    return r;
  }, { values: { username } });
  const e = state.errors ?? {};
  return (
    <form action={action}>
      <FormCard
        footer={
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        }
      >
        {/* keyed on the stored photo so "remove" and the preview reset after a save */}
        <PhotoPicker key={photoUrl ?? "none"} existingUrl={photoUrl} />
        <FieldError message={e.photo} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" defaultValue={state.values?.username ?? username} maxLength={USERNAME_MAX} required aria-invalid={Boolean(e.username) || undefined} />
          <FieldError message={e.username} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} readOnly disabled aria-describedby="email-note" />
            <p id="email-note" className="text-xs text-muted-foreground">Your sign-in email can’t be changed here.</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-none">Member since</span>
            <p className="flex h-9 items-center text-sm">{formatDate(created)}</p>
          </div>
        </div>
      </FormCard>
    </form>
  );
}
