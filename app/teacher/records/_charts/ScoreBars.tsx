// Average total (out of 100) per subject, as vertical bars. Single series in flame blue: the resting bars are a
// lighter step (below 3:1 on the card, so every bar carries its value label and a table view sits alongside),
// the hovered or focused bar goes solid with a tooltip. Pure CSS, no client JavaScript.
const TICKS = [100, 80, 60, 40, 20, 0];
const one = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// `counted` names what `semesters` counts: semesters on a student record, graded students on the teacher home.
export function ScoreBars({ data, counted = "semester" }: { data: { subject: string; avg: number; semesters: number }[]; counted?: "semester" | "student graded" }) {
  return (
    <figure className="flex flex-col gap-3">
      {/* scrolls sideways inside the panel when there are many subjects; the page itself never does */}
      <div className="overflow-x-auto pb-1">
        <div className="relative grid min-w-fit grid-cols-[2rem_1fr] gap-x-3 pt-20">
          {/* y axis + recessive gridlines */}
          <div className="relative h-56" aria-hidden="true">
            {TICKS.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" style={{ top: `${100 - t}%` }}>{t}</span>
            ))}
          </div>
          <div className="relative h-56">
            {TICKS.map((t) => (
              <span key={t} aria-hidden="true" className={`absolute inset-x-0 border-t ${t === 0 ? "border-border" : "border-dashed border-border/60"}`} style={{ top: `${100 - t}%` }} />
            ))}
            <ul className="relative flex h-full items-end gap-3 px-2" aria-label="Average total by subject">
              {data.map((d) => (
                <li key={d.subject} className="relative flex h-full max-w-24 min-w-14 flex-1 flex-col items-center justify-end">
                  <button
                    type="button"
                    tabIndex={0}
                    aria-label={`${d.subject}: average total ${one(d.avg)} out of 100`}
                    className="group relative flex h-full w-full cursor-default flex-col items-center justify-end outline-none"
                  >
                    {/* tooltip */}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute z-10 w-max max-w-48 -translate-y-2 rounded-xl bg-sidebar px-3 py-2 text-left text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      style={{ bottom: `${d.avg}%` }}
                    >
                      <span className="block font-medium">{d.subject}</span>
                      <span className="block text-white/80">Average total {one(d.avg)} / 100</span>
                      <span className="block text-white/60">{d.semesters} {counted === "semester" ? (d.semesters === 1 ? "semester" : "semesters") : (d.semesters === 1 ? "student graded" : "students graded")}</span>
                    </span>
                    <span className="mb-1 text-xs font-medium tabular-nums">{one(d.avg)}</span>
                    <span
                      className="w-full rounded-t-[4px] bg-primary/60 transition-colors group-hover:bg-primary group-focus-visible:bg-primary group-focus-visible:ring-3 group-focus-visible:ring-ring/40"
                      style={{ height: `${Math.max(d.avg, 0.5)}%` }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <span />
          <ul className="mt-2 flex gap-3 px-2" aria-hidden="true">
            {data.map((d) => (
              <li key={d.subject} className="line-clamp-2 max-w-24 min-w-14 flex-1 text-center text-xs break-words text-muted-foreground" title={d.subject}>{d.subject}</li>
            ))}
          </ul>
        </div>
      </div>
      <table className="sr-only">
        <caption>Average total by subject</caption>
        <thead><tr><th scope="col">Subject</th><th scope="col">Average total out of 100</th><th scope="col">{counted === "semester" ? "Semesters" : "Students graded"}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.subject}><th scope="row">{d.subject}</th><td>{one(d.avg)}</td><td>{d.semesters}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
