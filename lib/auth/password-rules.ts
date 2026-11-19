// Password requirements, shared by the set-password form (live checklist) and the server (final check).
// Client-safe: no server imports.
import { dictionary } from "@zxcvbn-ts/language-common";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 15;

// ~49k common passwords (MIT list). Compared lowercased and with symbols/spaces removed, so "Password1!" counts as
// "password1". shortcut: a dictionary, not a breached-password database; swap in a larger list if needed.
const COMMON = new Set((dictionary["passwords-common"] as string[]).map((p) => p.toLowerCase()));
const isCommon = (p: string) => COMMON.has(p.toLowerCase()) || COMMON.has(p.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));

export const PASSWORD_RULES = [
  { id: "upper", label: "At least one capital letter", test: (p: string) => /\p{Lu}/u.test(p) },
  { id: "special", label: "At least one special character (e.g. @, !)", test: (p: string) => /[^\p{L}\p{N}\s]/u.test(p) },
  { id: "length", label: `${PASSWORD_MIN} to ${PASSWORD_MAX} characters`, test: (p: string) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX },
  { id: "lower", label: "At least one lowercase letter", test: (p: string) => /\p{Ll}/u.test(p) },
  { id: "common", label: "Not a common password (e.g. Password1!)", test: (p: string) => p.length > 0 && !isCommon(p) },
] as const;

export const unmetRules = (password: string) => PASSWORD_RULES.filter((r) => !r.test(password));

export type StrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

// 0 (empty) to 5 (every requirement met), with the label shown next to the strength bar.
export function passwordStrength(password: string): { score: StrengthScore; label: string } {
  if (!password) return { score: 0, label: "" };
  const score = (PASSWORD_RULES.length - unmetRules(password).length) as StrengthScore;
  return { score, label: ["Very weak", "Very weak", "Weak", "Fair", "Good", "Strong"][score] };
}
