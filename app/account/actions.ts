"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/auth/audit";
import { ROLE_HOME, isRole } from "@/lib/auth/roles";
import { changeActiveRole, destroySession, getSession } from "@/lib/auth/session";

// The role comes from the client, so it is only accepted if the user holds it (checked in the database).
export async function switchRole(role: string): Promise<void> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!(await changeActiveRole(s.id, role)) || !isRole(role)) {
    await audit("role_switch_denied", { userId: s.userId, email: s.email, detail: { role: String(role).slice(0, 20) } });
    throw new Error("You don't have that role.");
  }
  await audit("role_switch", { userId: s.userId, email: s.email, detail: { from: s.activeRole, to: role } });
  revalidatePath("/", "layout"); // the sidebar (in the root layout) shows the active role
  redirect(ROLE_HOME[role]);
}

export async function logout(): Promise<void> {
  const s = await getSession();
  await destroySession();
  if (s) await audit("logout", { userId: s.userId, email: s.email });
  revalidatePath("/", "layout");
  redirect("/login");
}
