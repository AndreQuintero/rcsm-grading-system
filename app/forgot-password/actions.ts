"use server";

import { after } from "next/server";
import { audit } from "@/lib/auth/audit";
import { startPasswordReset } from "@/lib/auth/first-sign-in";
import { allowAttempt, clientIp } from "@/lib/auth/rate-limit";
import { isEmail, normalizeEmail } from "@/lib/auth/roles";

export type ForgotState = { sent?: boolean; error?: string };

// Same answer for every email (unknown, inactive, rate limited, or a real account): the account-dependent work
// runs after the response, so neither the body nor its timing says whether the email exists.
export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = normalizeEmail(formData.get("email"));
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  const ip = await clientIp();
  if (await allowAttempt("forgot", ip, email)) after(() => startPasswordReset(email));
  else after(() => audit("rate_limited", { email, ip, detail: { step: "forgot" } }));
  return { sent: true };
}
