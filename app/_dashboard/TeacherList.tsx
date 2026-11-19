"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { DashboardTeacher } from "@/lib/dashboard";
import { Avatar } from "./Avatar";

const photo = (t: DashboardTeacher) => (t.hasPhoto ? `/teachers/${t.id}/photo` : null);

// The semester's teachers; picking one opens their details from the bottom of the screen.
export function TeacherList({ teachers, period }: { teachers: DashboardTeacher[]; period: string }) {
  const [open, setOpen] = useState<DashboardTeacher | null>(null);
  // keep the last teacher while the drawer slides out, so its content doesn't vanish mid-animation
  const [shown, setShown] = useState<DashboardTeacher | null>(null);

  return (
    <>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {teachers.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => { setShown(t); setOpen(t); }}
              className="flex w-full items-center gap-4 rounded-xl px-2 py-3.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Avatar src={photo(t)} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {t.subjects.length} subject{t.subjects.length === 1 ? "" : "s"} this semester
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85vh] max-w-2xl gap-0 overflow-y-auto rounded-t-[2rem] border-0 px-6 pt-3 pb-10 shadow-[0_-20px_60px_-20px_rgba(43,46,51,0.45)] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] sm:px-10"
        >
          <span className="mx-auto mb-6 block h-1.5 w-12 rounded-full bg-muted-foreground/25" aria-hidden="true" />
          {shown && (
            <>
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <Avatar src={photo(shown)} className="size-24 ring-4 ring-accent" />
                <div className="min-w-0">
                  <SheetTitle className="font-heading text-3xl font-bold">{shown.name}</SheetTitle>
                  <SheetDescription className="mt-1">Teacher, {shown.age} years old</SheetDescription>
                  <a href={`mailto:${shown.email}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
                    <Mail className="size-4" aria-hidden="true" />
                    {shown.email}
                  </a>
                </div>
              </div>
              <div className="mt-8 rounded-2xl bg-muted/50 p-5">
                <h3 className="text-sm font-medium">Teaching in {period}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {shown.subjects.map((s) => (
                    <li key={s} className="rounded-full bg-card px-3.5 py-1.5 text-sm font-medium shadow-xs ring-1 ring-border">{s}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
