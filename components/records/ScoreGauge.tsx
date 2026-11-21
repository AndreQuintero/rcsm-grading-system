// Points earned out of the points possible so far, as a half ring (grey track, flame-blue arc).
export function ScoreGauge({ earned, possible, pct }: { earned: number; possible: number; pct: number }) {
  return (
    <figure className="flex flex-col items-center">
      <div className="relative w-full max-w-64">
        <svg viewBox="0 0 200 110" className="w-full" role="img" aria-label={`${pct}% of the possible points: ${earned} of ${possible}`}>
          <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" className="stroke-muted" strokeWidth="18" strokeLinecap="round" pathLength={100} />
          {pct > 0 && (
            <path d="M 18 100 A 82 82 0 0 1 182 100" fill="none" className="stroke-primary" strokeWidth="18" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} />
          )}
        </svg>
        <p className="absolute inset-x-0 bottom-0 text-center font-heading text-5xl font-bold leading-none tabular-nums" aria-hidden="true">{pct}%</p>
      </div>
      <figcaption className="mt-4 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground tabular-nums">
        {earned} of {possible} points
      </figcaption>
    </figure>
  );
}
