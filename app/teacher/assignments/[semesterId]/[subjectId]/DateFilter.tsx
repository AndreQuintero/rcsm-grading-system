"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

// Optional date for the assignment filter. A native date field can't be emptied on phones once touched (iOS fills in
// today), so an × clears it; an empty field isn't posted, which means "any date".
export function DateFilter({ id, defaultValue }: { id: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="relative">
      <Input
        id={id}
        name={value ? "date" : undefined}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={`${id}-hint`}
        className={value ? "pr-9" : undefined}
      />
      <span id={`${id}-hint`} className="sr-only">Optional. Leave empty for any date.</span>
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear the date"
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
