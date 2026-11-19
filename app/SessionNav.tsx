import { LogOut, Repeat } from "lucide-react";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { logout, switchRole } from "./account/actions";
import { NavLinks } from "./NavLinks";

// Navigation and account box for the signed-in user; nothing when signed out (the login pages).
export async function SessionNav() {
  const s = await getSession();
  if (!s) return null;
  const others = s.roles.filter((r) => r !== s.activeRole);
  const button =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring";
  return (
    <div className="flex items-center gap-2 md:block">
      <NavLinks admin={s.activeRole === "admin"} homeHref={ROLE_HOME[s.activeRole]} />
      <div className="md:mt-8 md:border-t md:border-white/10 md:pt-5">
        <div className="hidden px-2 md:block">
          <p className="truncate text-sm font-medium text-white">{s.username}</p>
          <p className="text-xs text-sidebar-foreground/70">{ROLE_LABEL[s.activeRole]}</p>
        </div>
        <div className="flex gap-1 md:mt-3 md:flex-col">
          {others.map((r) => (
            <form key={r} action={switchRole.bind(null, r)}>
              <button type="submit" className={button} aria-label={`Switch to ${ROLE_LABEL[r]}`}>
                <Repeat className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">Switch to {ROLE_LABEL[r]}</span>
              </button>
            </form>
          ))}
          <form action={logout}>
            <button type="submit" className={button} aria-label="Sign out">
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
