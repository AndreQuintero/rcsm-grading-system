"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/auth/audit";
import { ROLE_HOME, isRole } from "@/lib/auth/roles";
import { changeActiveRole, destroySession, getSession } from "@/lib/auth/session";
import { changePassword, updateAccount } from "@/lib/auth/account";
import type { AccountState, ChangePasswordState } from "@/lib/auth/account-shared";

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

// Any signed-in user, on their own account only (the user id comes from the session, never the form).
export async function updateAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const s = await getSession();
  if (!s) redirect("/login");
  const r = await updateAccount(s.userId, formData);
  if (!r.errors) revalidatePath("/", "layout"); // the sidebar shows the username and avatar
  return r;
}

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const s = await getSession();
  if (!s) redirect("/login");
  return changePassword(s.userId, s.email, s.id, formData);
}
