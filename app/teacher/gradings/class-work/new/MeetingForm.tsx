"use client";

import { useActionState } from "react";
import { FormCard } from "@/components/form-card";
import { FieldError } from "@/components/form-message";
import { useSavedRedirect } from "@/components/use-saved-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEETING_NAME_MAX, type MeetingFormState } from "@/lib/class-work-shared";
import { createMeetingAction, updateMeetingAction } from "../actions";

type Props = { semesterId: number; period: string; meetingId?: number; initial?: Record<string, string> };

// Registers a weekly meeting in the semester, or edits one when meetingId is given. The semester can't change.
export function MeetingForm({ semesterId, period, meetingId, initial = {} }: Props) {
  const saved = useSavedRedirect(`/teacher/gradings/class-work?semester=${semesterId}`);
  const [state, action, pending] = useActionState(async (prev: MeetingFormState, fd: FormData) => {
    const r = meetingId ? await updateMeetingAction(meetingId, prev, fd) : await createMeetingAction(semesterId, prev, fd);
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
            {meetingId ? (pending ? "Saving…" : "Save changes") : pending ? "Registering…" : "Register weekly meeting"}
          </Button>
        }
      >
        <FieldError message={e.form} />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Academic semester</span>
          <p className="text-sm text-muted-foreground">{period}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={MEETING_NAME_MAX} defaultValue={v.name ?? ""} placeholder="e.g. Week #1"
              aria-invalid={Boolean(e.name)} />
            <FieldError message={e.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="heldOn">Date</Label>
            <Input id="heldOn" name="heldOn" type="date" required defaultValue={v.heldOn ?? ""}
              aria-invalid={Boolean(e.heldOn)} />
            <FieldError message={e.heldOn} />
          </div>
        </div>
      </FormCard>
    </form>
  );
}
