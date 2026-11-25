import { ChevronRight, ClipboardCheck, NotebookPen } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

// Static: the proxy already requires the teacher role on /teacher, and both targets check it again.
const OPTIONS = [
  { href: "/teacher/gradings/final", title: "Final gradings", text: "The 4 grades and the total of each student, per subject.", icon: ClipboardCheck, dark: true },
  { href: "/teacher/gradings/class-work", title: "Class work", text: "Grade the class work of your subjects.", icon: NotebookPen, dark: false },
];

export default function Page() {
  return (
    <main>
      <PageHeader title="Gradings" description="Choose what to grade." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ href, title, text, icon: Icon, dark }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "group flex h-full items-start gap-4 rounded-[1.75rem] p-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                // dark like the "All semesters" card of the records
                dark
                  ? "bg-sidebar text-white transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(43,46,51,0.6)]"
                  : "border border-border/70 bg-card transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_12px_32px_-16px_rgba(46,99,207,0.35)]",
              )}
            >
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", dark ? "bg-white/10" : "bg-primary/10 text-primary")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-xl font-bold leading-tight">{title}</span>
                <span className={cn("mt-1 block text-sm", dark ? "text-white/70" : "text-muted-foreground")}>{text}</span>
              </span>
              <ChevronRight className={cn("size-5 shrink-0 transition-transform group-hover:translate-x-0.5", dark ? "text-white/70" : "text-muted-foreground")} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
