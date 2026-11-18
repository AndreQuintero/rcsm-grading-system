import { Search, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Filter / Clear filters row for the list pages; Clear only shows while a filter is active.
export function FilterActions({ clearHref, filtered }: { clearHref: string; filtered: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {filtered && (
        <Button variant="ghost" asChild>
          <Link href={clearHref}>
            <X aria-hidden="true" />
            Clear filters
          </Link>
        </Button>
      )}
      <Button type="submit">
        <Search aria-hidden="true" />
        Filter
      </Button>
    </div>
  );
}
