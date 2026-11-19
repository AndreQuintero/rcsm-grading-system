"use client";

import { BookOpen, GraduationCap, Home, Layers, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/admins", label: "Admins", icon: ShieldCheck },
];

// Admins get the management pages; other roles get their home. The server decides which (and enforces it).
export function NavLinks({ admin, homeHref }: { admin: boolean; homeHref: string }) {
  const pathname = usePathname();
  const items = admin ? ADMIN_NAV : [{ href: homeHref, label: "Home", icon: Home }];
  return (
    <nav aria-label="Main" className="flex gap-1 md:mt-10 md:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring md:px-3",
              active && "bg-sidebar-accent text-white md:shadow-[inset_3px_0_0_var(--sidebar-primary)]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
