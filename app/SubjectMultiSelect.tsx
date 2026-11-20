"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Option = { id: number; name: string };

// Searchable multi-select. Each chosen id is posted as a hidden input named `name`,
// so it works in plain GET forms and in server-action forms alike.
export function SubjectMultiSelect({
  options,
  name,
  label,
  defaultValue = [],
  placeholder = "Type to search subjects…",
}: {
  options: Option[];
  name: string;
  label: string;
  defaultValue?: number[];
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<number[]>(() => defaultValue.filter((id) => options.some((o) => o.id === id)));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();

  const byId = new Map(options.map((o) => [o.id, o]));
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !selected.includes(o.id) && o.name.toLowerCase().includes(q));
  const activeOption = open ? matches[Math.min(active, matches.length - 1)] : undefined;

  const add = (id: number) => {
    setSelected((s) => [...s, id]);
    setQuery("");
    setActive(0);
    setNavigated(false);
    setOpen(false); // close after each pick so the list never sits over the buttons below
    input.current?.focus();
  };
  const remove = (id: number) => setSelected((s) => s.filter((x) => x !== id));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setNavigated(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => Math.max(0, Math.min(matches.length - 1, a + step)));
    } else if (e.key === "Enter" && activeOption && (q || navigated)) {
      // Pick the highlighted subject; a plain Enter with nothing typed still submits the form.
      e.preventDefault();
      add(activeOption.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
    }
  };

  return (
    <div className="relative flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium leading-none">
        {label}
      </span>
      {/* Clicking anywhere in the box focuses the search input. */}
      <div
        className="flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-0.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
        onClick={() => {
          input.current?.focus();
          setOpen(true);
        }}
      >
        <Search className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {selected.map((id) => {
          const o = byId.get(id);
          return (
            o && (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-md bg-accent py-0.5 pr-1 pl-2 text-xs font-medium text-accent-foreground"
              >
                {o.name}
                <button
                  type="button"
                  aria-label={`Remove ${o.name}`}
                  className="grid size-4 place-items-center rounded-sm opacity-70 outline-none hover:bg-primary/15 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => {
                    e.stopPropagation(); // don't let the box re-focus the input and re-open the list
                    remove(id);
                  }}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            )
          );
        })}
        <input
          ref={input}
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
          value={query}
          placeholder={selected.length ? "Search to add more…" : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setNavigated(false);
          }}
          onKeyDown={onKeyDown}
          className="h-6 min-w-32 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
        />
        <ChevronDown className="mr-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {matches.map((o) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={o === activeOption}
              className={cn("cursor-pointer rounded-md px-2 py-1.5", o === activeOption && "bg-accent text-accent-foreground")}
              // mousedown + preventDefault keeps focus in the input so the list does not close first
              onMouseDown={(e) => {
                e.preventDefault();
                add(o.id);
              }}
              onMouseEnter={() => setActive(matches.indexOf(o))}
            >
              {o.name}
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-1.5 text-muted-foreground" role="option" aria-selected={false} aria-disabled="true">
              {options.length === 0 ? "No subjects registered yet" : q ? "No matching subjects" : "All subjects selected"}
            </li>
          )}
        </ul>
      )}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
