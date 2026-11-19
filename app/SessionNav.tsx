import { LogOut, Repeat } from "lucide-react";
import Link from "next/link";
import { GenericAvatar } from "@/components/generic-avatar";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { logout, switchRole } from "./account/actions";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

// Navigation and account box for the signed-in user; nothing when signed out (the login pages).
// Desktop: the sidebar column. Phones: the same pieces inside the burger menu panel.
export async function SessionNav() {
  const s = await getSession();
  if (!s) return null;
  const others = s.roles.filter((r) => r !== s.activeRole);
  const button =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring";

  const account = (large: boolean) => (
    <Link
      href="/account"
      aria-label={`Your account: ${s.username}`}
      className={cn(
        "flex items-center gap-3 rounded-lg outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        large ? "bg-white/5 p-3 ring-1 ring-white/10" : "px-2 py-1.5",
      )}
    >
      <span className={cn("shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20", large ? "size-14 ring-2 ring-sidebar-primary/70" : "size-9")}>
        {s.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, session-bound image; next/image would cache it
          <img src={`/account/photo?v=${s.photoVersion}`} alt="" width={56} height={56} className="size-full object-cover" />
        ) : (
          <GenericAvatar className="text-white" />
        )}
      </span>
      <div className="min-w-0">
        <p className={cn("truncate font-medium text-white", large ? "text-base" : "text-sm")}>{s.username}</p>
        <p className="text-xs text-sidebar-foreground/70">{ROLE_LABEL[s.activeRole]}</p>
      </div>
    </Link>
  );
  const nav = <NavLinks admin={s.activeRole === "admin"} homeHref={ROLE_HOME[s.activeRole]} />;
  const actions = (
    <div className="flex flex-col gap-1">
      {others.map((r) => (
        <form key={r} action={switchRole.bind(null, r)}>
          <button type="submit" className={button}>
            <Repeat className="size-4 shrink-0" aria-hidden="true" />
            Switch to {ROLE_LABEL[r]}
          </button>
        </form>
      ))}
      <form action={logout}>
        <button type="submit" className={button}>
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
  // each group slides in a beat after the previous one when the panel opens
  const enter = "animate-in fade-in-0 slide-in-from-right-6 fill-mode-both duration-500";

  return (
    <>
      <div className="hidden md:block">
        <div className="mt-10">{nav}</div>
        <div className="mt-8 border-t border-white/10 pt-5">
          {account(false)}
          <div className="mt-3">{actions}</div>
        </div>
      </div>
      <MobileMenu>
        <div className={cn(enter, "delay-100")}>{account(true)}</div>
        <p className={cn(enter, "delay-150 mt-8 mb-2 px-3 text-xs font-medium tracking-wider text-sidebar-foreground/50 uppercase")}>Menu</p>
        <div className={cn(enter, "delay-200")}>{nav}</div>
        <div className={cn(enter, "delay-300 mt-auto border-t border-white/10 pt-4")}>{actions}</div>
      </MobileMenu>
    </>
  );
}
