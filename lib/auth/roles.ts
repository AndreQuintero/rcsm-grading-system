// Client-safe role and redirect helpers (no server imports).

// Highest priority first: decides the username source and the active role at sign-in.
export const ROLES = ["admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Record<Role, string> = { admin: "/", teacher: "/teacher", student: "/student" };
export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", teacher: "Teacher", student: "Student" };

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
export const highestRole = (roles: readonly Role[]): Role | null => ROLES.find((r) => roles.includes(r)) ?? null;

export const normalizeEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
export const isEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// The role a path belongs to. Note "/teachers" (admin page) is not "/teacher" (teacher area).
export function requiredRole(pathname: string): Role {
  const inArea = (base: string) => pathname === base || pathname.startsWith(base + "/");
  if (inArea("/teacher")) return "teacher";
  if (inArea("/student")) return "student";
  return "admin";
}

// Only a relative internal path is accepted as a redirect target, so ?next= can't send anyone off-site.
export function safeNext(next: unknown, fallback: string): string {
  const p = typeof next === "string" ? next : "";
  if (!p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\") || p.length > 512 || /[\u0000-\u001f\\]/.test(p)) return fallback;
  return p;
}
