"use server";

import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { audit } from "@/lib/auth/audit";
import {
  DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, deletePasskey, newDeviceToken, registrationOptions, verifyRegistration,
} from "@/lib/auth/passkey";
import { getSession } from "@/lib/auth/session";

const NEED_PASSWORD = "Sign in with your password on this device first, then turn on biometric sign-in.";

// Enrollment needs a session that was started with the password on this device (the "password first" rule).
async function passwordSession() {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s.method === "password" ? s : null;
}

export async function startPasskeyEnrollment(): Promise<{ options?: PublicKeyCredentialCreationOptionsJSON; error?: string }> {
  const s = await passwordSession();
  if (!s) return { error: NEED_PASSWORD };
  const options = await registrationOptions({ id: s.userId, email: s.email, username: s.username }, (await cookies()).get(DEVICE_COOKIE)?.value);
  return { options };
}

export async function finishPasskeyEnrollment(response: RegistrationResponseJSON): Promise<{ error?: string }> {
  const s = await passwordSession();
  if (!s) return { error: NEED_PASSWORD };
  const jar = await cookies();
  const current = jar.get(DEVICE_COOKIE)?.value;
  const device = current && current.length <= 100 ? current : newDeviceToken();
  if (!(await verifyRegistration(s.userId, response, device, (await headers()).get("user-agent") ?? ""))) {
    return { error: "Biometric sign-in couldn't be turned on. Please try again." };
  }
  // httpOnly and long-lived: it is what ties the passkey to this browser; signing out keeps it
  jar.set(DEVICE_COOKIE, device, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DEVICE_COOKIE_MAX_AGE });
  await audit("passkey_added", { userId: s.userId, email: s.email });
  revalidatePath("/account");
  return {};
}

export async function removePasskey(id: string) {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  if (typeof id === "string" && (await deletePasskey(s.userId, id))) {
    await audit("passkey_removed", { userId: s.userId, email: s.email });
  }
  revalidatePath("/account");
}
