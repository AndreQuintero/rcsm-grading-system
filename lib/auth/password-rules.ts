// Password requirements, shared by the set-password form (live checklist) and the server (final check).
// Client-safe: no server imports.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 15;

export const PASSWORD_RULES = [
  { id: "upper", label: "At least one capital letter", test: (p: string) => /\p{Lu}/u.test(p) },
  { id: "special", label: "At least one special character (e.g. @, !)", test: (p: string) => /[^\p{L}\p{N}\s]/u.test(p) },
  { id: "length", label: `${PASSWORD_MIN} to ${PASSWORD_MAX} characters`, test: (p: string) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX },
  { id: "lower", label: "At least one lowercase letter", test: (p: string) => /\p{Ll}/u.test(p) },
] as const;

export const unmetRules = (password: string) => PASSWORD_RULES.filter((r) => !r.test(password));

// 0 (empty) to 4 (every requirement met), with the label shown next to the strength bar.
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: "" };
  const score = (PASSWORD_RULES.length - unmetRules(password).length) as 0 | 1 | 2 | 3 | 4;
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score] };
}
