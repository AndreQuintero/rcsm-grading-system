"use client";

import { CalendarRange, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Choice = { id: number | string; label: string; current: boolean };

// Picking a semester changes ?semester= so the server renders that semester's teachers and batches.
// basePath gets ?semester=<id>; pathTemplate (e.g. "/student-records/5/{id}") puts the id in the path instead.
export function SemesterSelect({ choices, value, basePath = "/", pathTemplate }: { choices: Choice[]; value: number | string; basePath?: string; pathTemplate?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select value={String(value)} onValueChange={(v) => start(() => router.replace(pathTemplate ? pathTemplate.replace("{id}", v) : `${basePath}?semester=${v}`, { scroll: false }))}>
      <SelectTrigger
        aria-label="Academic semester"
        className="h-11! gap-2.5 rounded-full border-0 bg-sidebar py-0 pr-4 pl-1.5 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(43,46,51,0.55)] transition-[background-color,box-shadow] hover:bg-sidebar/90 focus-visible:ring-sidebar-ring/60 [&>svg:last-child]:text-white/70"
      >
        <span className="grid size-8 place-items-center rounded-full bg-white/10">
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <CalendarRange className="size-4" aria-hidden="true" />}
        </span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="min-w-64 rounded-2xl p-1.5 shadow-xl">
        {choices.map((c) => (
          <SelectItem key={c.id} value={String(c.id)} className="rounded-xl py-2 pl-3 text-sm">
            {c.label}
            {c.current && <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">Now</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
