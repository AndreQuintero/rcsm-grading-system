"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

// Optional date for the assignment filter; empty = any date. Browsers make an empty native date field look filled
// (Safari shows today's date) and can't empty it once touched, so while no date is chosen this is a text field reading
// "Any date" that turns into the date picker on focus; an × clears a chosen date. An empty field isn't posted.
export function DateFilter({ id, defaultValue }: { id: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [editing, setEditing] = useState(false);
  const picking = editing || value !== "";
  return (
    <div className="relative">
      <Input
        id={id}
        name={value ? "date" : undefined}
        type={picking ? "date" : "text"}
        value={value}
        placeholder="Any date"
        autoComplete="off"
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={`${id}-hint`}
        className={value ? "pr-9" : undefined}
      />
      <span id={`${id}-hint`} className="sr-only">Optional. Leave empty for any date.</span>
      {value && (
        <button
          type="button"
          onClick={() => { setValue(""); setEditing(false); }}
          aria-label="Clear the date"
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
