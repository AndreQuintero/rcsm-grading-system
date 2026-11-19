import argon2 from "argon2";
import { dictionary } from "@zxcvbn-ts/language-common";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

// shortcut: the bundled list has ~49k common passwords but only ~300 of 12+ characters; swap in a larger
// breached-password list if stronger screening is needed.
const COMMON = new Set((dictionary["passwords-common"] as string[]).map((p) => p.toLowerCase()));

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

// Length 12-128, matching confirmation, not a common password. No composition rules.
export function parsePassword(
  formData: FormData,
): { password: string; errors?: undefined } | { errors: Record<string, string>; password?: undefined } {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const errors: Record<string, string> = {};
  if (password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (password.length > PASSWORD_MAX) errors.password = `Use at most ${PASSWORD_MAX} characters.`;
  else if (COMMON.has(password.toLowerCase())) errors.password = "This password is too common. Choose another.";
  if (!errors.password && confirm !== password) errors.confirmPassword = "The passwords don't match.";
  return Object.keys(errors).length ? { errors } : { password };
}
