"use server";

import { redirect } from "next/navigation";
import { hashPassword, parsePassword } from "@/lib/auth/password";
import { checkSetupToken, consumeSetupToken } from "@/lib/auth/tokens";

export type SetPasswordState = { errors?: Record<string, string> };

const INVALID_LINK = "This link is invalid or has expired. Enter your email on the login page to get a new one.";

// Sets the first password from an emailed link. The token is only used up here (POST), never by opening the link.
export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  // check the link before the password rules, so a dead link isn't reported as a password problem
  if (!(await checkSetupToken(token))) return { errors: { form: INVALID_LINK } };
  const parsed = parsePassword(formData);
  if (parsed.errors) return { errors: parsed.errors };
  if (!(await consumeSetupToken(token, await hashPassword(parsed.password)))) return { errors: { form: INVALID_LINK } };
  redirect("/login?set=1");
}
