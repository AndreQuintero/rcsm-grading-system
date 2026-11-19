import argon2 from "argon2";
import { unmetRules } from "@/lib/auth/password-rules";

// Sign-in accepts up to 128 characters: passwords set under the earlier 12-128 rule must keep working.
export const LOGIN_PASSWORD_MAX = 128;

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Spends the same work as a real check when there is no user, so timing does not reveal whether an email exists.
let dummyHash: Promise<string> | null = null;
export async function verifyDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy password that never matches anything");
  await verifyPassword(await dummyHash, password);
  return false;
}

// The requirements in password-rules.ts (also shown live on the form), plus a matching confirmation.
export function parsePassword(
  formData: FormData,
): { password: string; errors?: undefined } | { errors: Record<string, string>; password?: undefined } {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const errors: Record<string, string> = {};
  const unmet = unmetRules(password);
  if (unmet.length) errors.password = `The password still needs: ${unmet.map((r) => r.label.toLowerCase()).join("; ")}.`;
  else if (confirm !== password) errors.confirmPassword = "The passwords don't match.";
  return Object.keys(errors).length ? { errors } : { password };
}
