import { GenericAvatar } from "@/components/generic-avatar";
import { cn } from "@/lib/utils";

// Photo from an admin-only photo route, or the generic silhouette.
export function Avatar({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-card", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- private admin-only image; next/image would cache it
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <GenericAvatar />
      )}
    </span>
  );
}
