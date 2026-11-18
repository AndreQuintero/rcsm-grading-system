import { Pencil } from "lucide-react";
import Link from "next/link";

// Icon-only edit button for table rows; the label is the accessible name and the tooltip.
export function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="icon-action" aria-label={label} title={label}>
      <Pencil size={17} aria-hidden="true" />
    </Link>
  );
}
