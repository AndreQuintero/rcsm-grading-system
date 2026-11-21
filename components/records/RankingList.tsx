import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { ordinal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type RankingRow = {
  id: number;
  name: string;
  place: number | null; // null = not ranked yet (shown last, with a dash)
  photo: string | null;
  detail: ReactNode;
  value: ReactNode;
  href: string;
};

// 1st filled blue, 2nd soft blue, 3rd outlined, the rest grey.
const pill = ["bg-primary text-primary-foreground", "bg-primary/15 text-primary", "bg-card text-primary ring-1 ring-primary/30"];

// Ranked students (tied ones share a place): pill, avatar, name, detail line and score; each row is a link.
export function RankingList({ rows }: { rows: RankingRow[] }) {
  return (
    <ol className="-mx-2 flex flex-col gap-1">
      {rows.map((s) => (
        <li key={s.id}>
          <Link
            href={s.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40 sm:gap-4",
              s.place === 1 && "bg-primary/5",
            )}
          >
            <span className={cn("w-10 shrink-0 rounded-full py-1 text-center text-xs font-bold tabular-nums sm:w-12 sm:text-sm", (s.place && pill[s.place - 1]) || "bg-muted text-muted-foreground")}>
              {s.place ? <><span className="sr-only">Place </span>{ordinal(s.place)}</> : <><span aria-hidden="true">–</span><span className="sr-only">Not ranked</span></>}
            </span>
            <Avatar src={s.photo} className="size-10 sm:size-11" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{s.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{s.detail}</span>
            </span>
            <span className="shrink-0 text-right whitespace-nowrap">{s.value}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
