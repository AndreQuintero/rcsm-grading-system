import { ChevronRight, ClipboardCheck, NotebookPen } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

// Static: the proxy already requires the teacher role on /teacher, and both targets check it again.
const OPTIONS = [
  { href: "/teacher/gradings/final", title: "Final gradings", text: "The 4 grades and the total of each student, per subject.", icon: ClipboardCheck },
  { href: "/teacher/gradings/class-work", title: "Class work", text: "Grade the class work of your subjects.", icon: NotebookPen },
];

export default function Page() {
  return (
    <main>
      <PageHeader title="Gradings" description="Choose what to grade." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ href, title, text, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full items-start gap-4 rounded-[1.75rem] border border-border/70 bg-card p-6 outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_12px_32px_-16px_rgba(46,99,207,0.35)] focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-xl font-bold leading-tight">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
