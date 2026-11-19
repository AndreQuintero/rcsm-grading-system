import { cn } from "@/lib/utils";

// The mountain ridge from the logo, drawn as a quiet shape at the foot of the sidebar and the mobile menu.
export function Ridge({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-sidebar-foreground/10", className)}
      viewBox="0 0 256 160"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 160V118l30-22 22 14 34-46 26 30 18-14 30 34 26-52 32 44 20-18 18 22v70z" fill="currentColor" />
      <path d="M0 160v-20l44-30 30 16 40-30 36 26 30-18 40 24 36-18v50z" fill="currentColor" />
    </svg>
  );
}
