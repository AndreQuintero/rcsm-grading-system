"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PUBLIC_PATHS } from "@/lib/auth/roles";

// The root layout stays mounted across client-side navigations, so when a session expires and the proxy
// redirects to /login, the signed-in menu it rendered earlier would linger. On the sign-in pages nobody is
// signed in (the proxy sends signed-in users away from /login), so the menu is simply not shown there.
export function HideOnPublicPages({ children }: { children: ReactNode }) {
  return PUBLIC_PATHS.includes(usePathname()) ? null : children;
}
