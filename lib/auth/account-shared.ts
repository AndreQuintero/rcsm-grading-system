// Client-safe pieces of the account page (lib/auth/account.ts is server-only).
export const USERNAME_MAX = 80;
export type AccountState = { errors?: Record<string, string>; message?: string; values?: { username: string } };
export type ChangePasswordState = { errors?: Record<string, string>; changed?: boolean };
