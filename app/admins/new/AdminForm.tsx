"use client";

import { useActionState } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAdmin } from "../actions";
import { createAdmin, type AdminFormState } from "./actions";

type Props = { adminId?: number; hasPhoto?: boolean; initial?: Record<string, string> };

export function AdminForm({ adminId, hasPhoto = false, initial = {} }: Props) {
  const saved = useSavedRedirect("/admins");
  const [state, action, pending] = useActionState(async (prev: AdminFormState, formData: FormData) => {
    const r = adminId ? await updateAdmin(adminId, prev, formData) : await createAdmin(prev, formData);
    if (!r.errors) saved(r.message);
    return r;
  }, { values: initial });
  const v = state.values ?? initial;
  const e = state.errors ?? {};

  return (
    <form action={action}>
      <FormCard
        footer={
          <Button type="submit" size="lg" disabled={pending}>
            {adminId ? (pending ? "Saving…" : "Save changes") : pending ? "Registering…" : "Register admin"}
          </Button>
        }
      >
        <FieldError message={e.form} />
        <PhotoPicker existingUrl={adminId && hasPhoto ? `/admins/${adminId}/photo` : null} />
        <FieldError message={e.photo} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={v.fullName} required aria-invalid={Boolean(e.fullName) || undefined} />
          <FieldError message={e.fullName} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={v.email} required aria-invalid={Boolean(e.email) || undefined} />
            <FieldError message={e.email} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} required aria-invalid={Boolean(e.dateOfBirth) || undefined} />
            <FieldError message={e.dateOfBirth} />
          </div>
        </div>
      </FormCard>
    </form>
  );
}
