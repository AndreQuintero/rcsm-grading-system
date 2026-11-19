"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { startFirstSignIn } from "@/lib/auth/first-sign-in";
import { LOGIN_PASSWORD_MAX, verifyDummy, verifyPassword } from "@/lib/auth/password";
import { allowAttempt, clientIp } from "@/lib/auth/rate-limit";
import { highestRole, isEmail, isRole, normalizeEmail, requiredRole, ROLE_HOME, safeNext } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";

export type LoginState = { step: "email" | "password"; email?: string; message?: string; error?: string };

const SENT = "If this is your first sign-in, we've sent a link to your email to set your password.";
const INVALID = "Invalid email or password.";
const INACTIVE = "Your account is inactive. Please contact an administrator.";

// Step 1. The answer is the same for every email (unknown, inactive, has a password, first sign-in, rate limited):
// all account-dependent work runs after the response, so neither the body nor its timing tells them apart.
export async function submitEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(formData.get("email"));
  if (!isEmail(email)) return { step: "email", error: "Enter a valid email address." };
  const ip = await clientIp();
  if (await allowAttempt("email", ip, email)) {
    after(() => startFirstSignIn(email));
  } else {
    after(() => audit("rate_limited", { email, ip, detail: { step: "email" } }));
  }
  return { step: "password", email, message: SENT };
}

// Step 2. Unknown email, inactive account, no password yet, locked, rate limited and wrong password all give the
// same error, each after one Argon2 verification. An account inactivated by an admin is named only after the
// correct password.
export async function submitPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const fail: LoginState = { step: "password", email, error: INVALID };
  if (!isEmail(email) || !password || password.length > LOGIN_PASSWORD_MAX) {
    await verifyDummy(password.slice(0, LOGIN_PASSWORD_MAX));
    return fail;
  }

  const ip = await clientIp();
  if (!(await allowAttempt("password", ip, email))) {
    await verifyDummy(password);
    await audit("rate_limited", { email, ip, detail: { step: "password" } });
    return fail;
  }

  const [u] = await sql`
    SELECT id, password_hash, is_active, disabled_at IS NOT NULL AS disabled, coalesce(locked_until > now(), false) AS locked FROM users WHERE email = ${email}`;
  const reason = !u ? "unknown" : !u.is_active ? "inactive" : !u.password_hash ? "no_password" : u.locked ? "locked" : null;
  if (reason) {
    await verifyDummy(password);
    await audit("login_failure", { userId: (u?.id as number) ?? null, email, ip, detail: { reason } });
    return fail;
  }

  const userId = u.id as number;
  if (!(await verifyPassword(u.password_hash as string, password))) {
    // Every 5th consecutive failure locks the account: 15 min, then 30, 60, ... capped at 24 hours.
    const [r] = await sql`
      UPDATE users SET failed_login_count = failed_login_count + 1,
        locked_until = CASE WHEN (failed_login_count + 1) % 5 = 0
          THEN now() + least(interval '15 minutes' * power(2, (failed_login_count + 1) / 5 - 1), interval '24 hours')
          ELSE locked_until END
      WHERE id = ${userId}
      RETURNING failed_login_count, locked_until > now() AS locked`;
    await audit("login_failure", { userId, email, ip, detail: { reason: "wrong_password" } });
    if ((r.failed_login_count as number) % 5 === 0) await audit("account_locked", { userId, email, ip, detail: { failures: r.failed_login_count } });
    return fail;
  }

  // Told only after the right password, so the message can't be used to probe which emails exist.
  if (u.disabled) {
    await audit("login_failure", { userId, email, ip, detail: { reason: "disabled" } });
    return { step: "password", email, error: INACTIVE };
  }

  const roles = (await sql`SELECT role::text AS role FROM user_roles WHERE user_id = ${userId}`).map((r) => r.role).filter(isRole);
  const active = highestRole(roles);
  if (!active) {
    await audit("login_failure", { userId, email, ip, detail: { reason: "no_roles" } });
    return fail;
  }
  await sql`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ${userId}`;
  await createSession(userId, active, roles.includes("admin"));
  await audit("login_success", { userId, email, ip, detail: { role: active } });

  // Go back to the requested page only if it is internal and the user's roles allow it.
  revalidatePath("/", "layout"); // the root layout's sidebar now shows the signed-in navigation
  const next = safeNext(formData.get("next"), ROLE_HOME[active]);
  const need = requiredRole(next.split("?")[0]);
  redirect(!need || roles.includes(need) ? next : ROLE_HOME[active]);
}
