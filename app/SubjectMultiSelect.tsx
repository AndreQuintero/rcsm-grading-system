"use client";

import { useId, useRef, useState } from "react";

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
    <div className="multiselect">
      <span id={labelId} className="field-label">
        {label}
      </span>
      {/* Clicking anywhere in the box focuses the search input. */}
      <div
        className="multiselect-box"
        onClick={() => {
          input.current?.focus();
          setOpen(true);
        }}
      >
        {selected.map((id) => {
          const o = byId.get(id);
          return (
            o && (
              <span key={id} className="tag">
                {o.name}
                <button
                  type="button"
                  aria-label={`Remove ${o.name}`}
                  onClick={(e) => {
                    e.stopPropagation(); // don't let the box re-focus the input and re-open the list
                    remove(id);
                  }}
                >
                  ×
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
          placeholder={selected.length ? "" : placeholder}
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
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-multiselectable="true" className="multiselect-list">
          {matches.map((o) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={o === activeOption}
              className={o === activeOption ? "active" : undefined}
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
            <li className="empty" role="option" aria-selected={false} aria-disabled="true">
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
