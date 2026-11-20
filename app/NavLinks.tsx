"use client";

import { BookOpen, CalendarRange, ChartColumn, ClipboardCheck, GraduationCap, Home, Layers, ShieldCheck, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/student-records", label: "Student records", icon: ChartColumn },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/academic-semesters", label: "Semesters", icon: CalendarRange },
  { href: "/admins", label: "Admins", icon: ShieldCheck },
  { href: "/users", label: "Users", icon: UserCog },
];

const STUDENT_NAV = [
  { href: "/student", label: "Home", icon: Home, exact: true },
  { href: "/student/records", label: "My records", icon: ChartColumn },
];

const TEACHER_NAV = [
  { href: "/teacher", label: "Home", icon: Home, exact: true },
  { href: "/teacher/gradings", label: "Gradings", icon: ClipboardCheck },
  { href: "/teacher/records", label: "Score records", icon: ChartColumn },
];

// Each role gets its own pages; the server decides which (and enforces it).
export function NavLinks({ role, homeHref }: { role: string; homeHref: string }) {
  const pathname = usePathname();
  const items: { href: string; label: string; icon: typeof Home; exact?: boolean }[] =
    role === "admin" ? ADMIN_NAV : role === "teacher" ? TEACHER_NAV : role === "student" ? STUDENT_NAV : [{ href: homeHref, label: "Home", icon: Home }];
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = pathname === href || (!exact && pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium md:py-2 text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active && "bg-sidebar-accent text-white shadow-[inset_3px_0_0_var(--sidebar-primary)]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
