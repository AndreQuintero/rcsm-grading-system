"use client";

import { BookOpen, GraduationCap, Layers, ShieldCheck, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/admins", label: "Admins", icon: ShieldCheck },
];

// App navigation: a charcoal sidebar on desktop, a compact top bar on small screens.
export function SiteHeader() {
  return (
    <header className="relative z-10 shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:pt-7 md:pb-6">
        <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.08)] md:size-14">
            <Image src="/logo.png" alt="" width={56} height={56} priority className="size-10 rounded-full md:size-[52px]" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-lg font-bold tracking-wide text-white md:text-xl">Revival Cry</span>
            <span className="hidden text-xs text-sidebar-foreground/70 sm:block">School of Ministry</span>
          </span>
        </Link>

        {/* the current path is request-time data under cacheComponents, so highlight it inside Suspense */}
        <Suspense fallback={<NavLinks pathname="" />}>
          <ActiveNavLinks />
        </Suspense>
      </div>

      {/* The mountain ridge from the logo, drawn as a quiet line at the foot of the sidebar. */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-40 w-full text-sidebar-foreground/10 md:block"
        viewBox="0 0 256 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 160V118l30-22 22 14 34-46 26 30 18-14 30 34 26-52 32 44 20-18 18 22v70z" fill="currentColor" />
        <path d="M0 160v-20l44-30 30 16 40-30 36 26 30-18 40 24 36-18v50z" fill="currentColor" />
      </svg>
    </header>
  );
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="flex gap-1 md:mt-10 md:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
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
