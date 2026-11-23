"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/auth/audit";
import { deleteAllPasskeys } from "@/lib/auth/passkey";
import { requireRole } from "@/lib/auth/session";
import { getUser, setUserDisabled } from "@/lib/user";

export async function setUserActive(id: number, active: boolean): Promise<{ message?: string; error?: string }> {
  const me = await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid user id");
  // an admin locking themselves out could leave the school with no admin
  if (id === me.userId) return { error: "You can't inactivate your own account." };
  const email = await setUserDisabled(id, !active);
  if (!email) return { error: "This user no longer exists." };
  await audit(active ? "user_enabled" : "user_disabled", { userId: id, email, detail: { by: me.userId } });
  revalidatePath("/users");
  return { message: active ? "User reactivated. They can sign in again." : "User inactivated. They can no longer sign in." };
}

// Removes every biometric sign-in device of the user (e.g. a lost phone). Their password and sessions are untouched.
export async function clearUserPasskeys(id: number): Promise<{ message?: string; error?: string }> {
  const me = await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid user id");
  const u = await getUser(id);
  if (!u) return { error: "This user no longer exists." };
  const n = await deleteAllPasskeys(id);
  await audit("passkeys_cleared", { userId: id, email: u.email as string, detail: { by: me.userId, count: n } });
  revalidatePath(`/users/${id}`);
  return { message: n ? `Removed ${n} biometric device${n === 1 ? "" : "s"}. They sign in with their password until they turn it on again.` : "This user has no biometric devices." };
}
