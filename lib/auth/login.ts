import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { DEVICE_COOKIE, userHasPasskeyOnDevice } from "@/lib/auth/passkey";
import { highestRole, isRole, requiredRole, ROLE_HOME, safeNext } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";

// Read (and cleared) by the client prompt that offers biometric sign-in after a password sign-in.
export const OFFER_BIOMETRICS_COOKIE = "rcsm_offer_biometrics";

// The end of every sign-in, once the credential is verified and the account is allowed: starts the session and
// redirects. Returns only when the user holds no role.
export async function completeLogin({ userId, email, ip, method, next }: {
  userId: number; email: string; ip: string; method: "password" | "passkey"; next: FormDataEntryValue | null;
}): Promise<void> {
  const roles = (await sql`SELECT role::text AS role FROM user_roles WHERE user_id = ${userId}`).map((r) => r.role).filter(isRole);
  const active = highestRole(roles);
  if (!active) {
    await audit("login_failure", { userId, email, ip, detail: { reason: "no_roles", method } });
    return;
  }
  if (method === "password") await sql`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ${userId}`;
  await createSession(userId, active, roles.includes("admin"), method);
  await audit("login_success", { userId, email, ip, detail: { role: active, method } });
  const jar = await cookies();
  if (method === "password" && !(await userHasPasskeyOnDevice(userId, jar.get(DEVICE_COOKIE)?.value))) {
    // not httpOnly: the client prompt reads it; it carries no secret
    jar.set(OFFER_BIOMETRICS_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }

  // Go back to the requested page only if it is internal and the user's roles allow it.
  revalidatePath("/", "layout"); // the root layout's sidebar now shows the signed-in navigation
  const to = safeNext(next, ROLE_HOME[active]);
  const need = requiredRole(to.split("?")[0]);
  redirect(!need || roles.includes(need) ? to : ROLE_HOME[active]);
}
