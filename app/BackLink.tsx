import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Icon-only link back to a list page, shown in the header of register and edit pages.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-lg" className="rounded-full" asChild>
          <Link href={href} aria-label={label}>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
