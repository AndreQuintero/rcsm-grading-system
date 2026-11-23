"use server";

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { completeLogin } from "@/lib/auth/login";
import { authenticationOptions, DEVICE_COOKIE, verifyAuthentication } from "@/lib/auth/passkey";
import { clientIp, hit } from "@/lib/auth/rate-limit";

const FAILED = "Biometric sign-in didn't work. Sign in with your password instead.";
const INACTIVE = "Your account is inactive. Please contact an administrator.";

// Step 1: a one-time challenge for the passkeys enrolled on this device (the device cookie picks them).
export async function startPasskeyLogin(): Promise<{ options?: PublicKeyCredentialRequestOptionsJSON; error?: string }> {
  const ip = await clientIp();
  if (!(await hit(`passkey:ip:${ip}`, 20))) {
    await audit("rate_limited", { ip, detail: { step: "passkey" } });
    return { error: FAILED };
  }
  const options = await authenticationOptions((await cookies()).get(DEVICE_COOKIE)?.value);
  return options ? { options } : { error: "Biometric sign-in isn't turned on for this device. Sign in with your password." };
}

// Step 2: verifies the signed challenge, then the same account rules as the password sign-in. Redirects on success.
export async function finishPasskeyLogin(response: AuthenticationResponseJSON, next: string): Promise<{ error: string }> {
  const ip = await clientIp();
  const userId = await verifyAuthentication(response, (await cookies()).get(DEVICE_COOKIE)?.value);
  if (!userId) {
    await audit("login_failure", { ip, detail: { reason: "passkey_invalid", method: "passkey" } });
    return { error: FAILED };
  }
  const [u] = await sql`SELECT email, is_active, disabled_at IS NOT NULL AS disabled, coalesce(locked_until > now(), false) AS locked
    FROM users WHERE id = ${userId}`;
  const email = u.email as string;
  const reason = !u.is_active ? "inactive" : u.disabled ? "disabled" : u.locked ? "locked" : null;
  if (reason) {
    await audit("login_failure", { userId, email, ip, detail: { reason, method: "passkey" } });
    // the passkey proved who this is, so naming the block leaks nothing
    return { error: reason === "disabled" ? INACTIVE : FAILED };
  }
  await completeLogin({ userId, email, ip, method: "passkey", next: typeof next === "string" ? next : null });
  return { error: FAILED }; // reached only when the user holds no role
}
