"use client";

import { Check } from "lucide-react";
import { passwordStrength, PASSWORD_RULES } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";

const BAR = ["bg-transparent", "bg-destructive", "bg-amber-500", "bg-primary", "bg-success"];
const TEXT = ["text-destructive", "text-destructive", "text-amber-600", "text-primary", "text-success"];

// Strength bar and the requirement checklist, shown before and while typing. A met requirement is crossed
// out with an animated line (and un-crossed if it stops being met); the bar grows and changes colour.
export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Password strength</span>
          <span className={cn("font-medium transition-colors duration-300", TEXT[score])} aria-hidden="true">
            {label}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={PASSWORD_RULES.length}
          aria-valuenow={score}
          aria-valuetext={label || "No password yet"}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none", BAR[score])}
            style={{ width: `${(score / PASSWORD_RULES.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm" aria-label="Password requirements">
        {PASSWORD_RULES.map((r) => {
          const met = r.test(password);
          return (
            <li key={r.id} data-met={met} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                  met ? "border-success bg-success text-white" : "border-muted-foreground/40 bg-transparent",
                )}
                aria-hidden="true"
              >
                <Check className={cn("size-3 transition-[opacity,transform] duration-300", met ? "scale-100 opacity-100" : "scale-50 opacity-0")} strokeWidth={3} />
              </span>
              <span
                className={cn(
                  "relative transition-colors duration-300",
                  "after:absolute after:inset-x-0 after:top-1/2 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-300 after:ease-out motion-reduce:after:transition-none",
                  met ? "text-muted-foreground after:scale-x-100" : "text-foreground after:scale-x-0",
                )}
              >
                {r.label}
              </span>
              <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
