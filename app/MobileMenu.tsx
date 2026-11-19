"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Ridge } from "@/components/ridge";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Phones: a burger in the top bar opens the session menu as a panel sliding in from the right.
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownOn, setShownOn] = useState(pathname);
  // close after any navigation, including redirects from the switch-role action
  if (pathname !== shownOn) {
    setShownOn(pathname);
    setOpen(false);
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="grid size-11 place-items-center rounded-xl text-white outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-95 md:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[85vw] max-w-xs gap-0 overflow-y-auto border-white/10 bg-sidebar text-sidebar-foreground shadow-2xl duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden [&>[data-slot=sheet-close]]:text-sidebar-foreground/80 [&>[data-slot=sheet-close]]:hover:bg-sidebar-accent [&>[data-slot=sheet-close]]:hover:text-white"
        onClick={(e) => (e.target as Element).closest("a") && setOpen(false)}
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Your account and the app sections</SheetDescription>
        <div className="relative z-10 flex min-h-full flex-col px-4 pt-14 pb-6">{children}</div>
        <Ridge className="h-24 text-sidebar-foreground/[0.07]" />
      </SheetContent>
    </Sheet>
  );
}
