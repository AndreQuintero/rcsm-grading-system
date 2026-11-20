"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

// Single-choice select you can type into to narrow a long list. With `name`, the choice is posted as a hidden input,
// so it drops into a plain GET filter form like a native <select>. With `onPick`, picking is an action (e.g. "Add a
// teacher…"): the option is handed over and the field goes back to its placeholder.
export function SearchSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder,
  onPick,
  className,
}: {
  id: string;
  name?: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
  onPick?: (value: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState(() => (options.some((o) => o.value === defaultValue) ? defaultValue : ""));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const chosen = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => o.label.toLowerCase().includes(q));
  const activeOption = open ? matches[Math.min(active, matches.length - 1)] : undefined;

  const show = () => {
    setOpen(true);
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  };
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (o: Option) => {
    if (onPick) onPick(o.value);
    else setValue(o.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => Math.max(0, Math.min(matches.length - 1, a + step)));
    } else if (e.key === "Enter" && open) {
      // with the list open, Enter picks; with it closed, Enter submits the form as usual
      e.preventDefault();
      if (activeOption) pick(activeOption);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listId}-${matches.indexOf(activeOption)}` : undefined}
        autoComplete="off"
        value={open ? query : chosen?.label ?? ""}
        placeholder={open ? (chosen ? `Search… (${chosen.label})` : "Type to search…") : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onClick={() => !open && show()}
        onFocus={show}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={cn(
          "h-9 w-full cursor-pointer rounded-lg border border-input bg-transparent pr-8 pl-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:cursor-text focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          className,
        )}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {matches.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1.5",
                o === activeOption && "bg-accent text-accent-foreground",
                o.value === value && "font-medium",
              )}
              // mousedown + preventDefault keeps focus in the input so the list does not close first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {o.label}
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-1.5 text-muted-foreground" role="option" aria-selected={false} aria-disabled="true">
              No matches
            </li>
          )}
        </ul>
      )}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
