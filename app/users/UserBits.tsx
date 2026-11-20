import { GenericAvatar } from "@/components/generic-avatar";
import { Badge } from "@/components/ui/badge";
import { isRole, ROLE_LABEL } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { USER_STATUS_LABEL, type UserStatus } from "@/lib/user";

const TONE: Record<UserStatus, string> = {
  active: "bg-success/12 text-success",
  pending: "bg-primary/12 text-primary",
  inactive: "bg-destructive/10 text-destructive",
};

export function UserStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", TONE[status as UserStatus])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {USER_STATUS_LABEL[status as UserStatus] ?? status}
    </Badge>
  );
}

export function RoleTags({ roles }: { roles: string[] }) {
  if (!roles.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.filter(isRole).map((r) => (
        <Badge key={r} variant="outline">{ROLE_LABEL[r]}</Badge>
      ))}
    </div>
  );
}

export function UserAvatar({ id, hasPhoto, className }: { id: number; hasPhoto: boolean; className?: string }) {
  return (
    <span className={cn("shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border", className)}>
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- private admin-only image; next/image would cache it
        <img src={`/users/${id}/photo`} alt="" className="size-full object-cover" />
      ) : (
        <GenericAvatar className="text-muted-foreground" />
      )}
    </span>
  );
}
