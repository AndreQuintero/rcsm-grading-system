import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUSES, type Status } from "@/lib/student";

// Full time is green, audit is blue, inactive is neutral.
const TONE: Record<Status, string> = {
  full_time: "bg-success/12 text-success",
  audit: "bg-primary/12 text-primary",
  inactive: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", TONE[status as Status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUSES[status as Status] ?? status}
    </Badge>
  );
}
