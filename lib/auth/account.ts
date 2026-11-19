import { sql } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { hashPassword, parsePassword, verifyPassword } from "@/lib/auth/password";
import { hit } from "@/lib/auth/rate-limit";
import { parsePhoto, photoUpdate } from "@/lib/photo";
import { USERNAME_MAX, type AccountState, type ChangePasswordState } from "@/lib/auth/account-shared";

export async function getAccount(userId: number) {
  const [a] = await sql`
    SELECT username, email, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS created, photo IS NOT NULL AS has_photo
    FROM users WHERE id = ${userId} AND is_active`;
  return a ?? null;
}

// Username and avatar are the user's own; the email is the sign-in identity and is not editable here.
export async function updateAccount(userId: number, formData: FormData): Promise<AccountState> {
  const username = String(formData.get("username") ?? "").trim().replace(/\s+/g, " ");
  const { photo, error } = parsePhoto(formData);
  const errors: Record<string, string> = {};
  if (!username) errors.username = "Username is required.";
  else if (username.length > USERNAME_MAX) errors.username = `Use at most ${USERNAME_MAX} characters.`;
  if (error) errors.photo = error;
  if (Object.keys(errors).length) return { errors, values: { username } };

  const p = await photoUpdate(formData, photo);
  await sql`
    UPDATE users SET username = ${username}, updated_at = now(),
      photo = CASE WHEN ${p.replace}::boolean THEN decode(${p.b64}::text, 'base64') ELSE photo END,
      photo_type = CASE WHEN ${p.replace}::boolean THEN ${p.type}::text ELSE photo_type END
    WHERE id = ${userId}`;
  return { message: "Account updated.", values: { username } };
}

const WRONG = "Your current password is incorrect.";

// Needs the current password; the new one follows the same rules as the set-password form.
// Other sessions of the user end; the one making the change stays signed in.
export async function changePassword(userId: number, email: string, sessionId: string, formData: FormData): Promise<ChangePasswordState> {
  if (!(await hit(`change:user:${userId}`))) {
    await audit("rate_limited", { userId, email, detail: { step: "change_password" } });
    return { errors: { form: "Too many attempts. Wait 15 minutes and try again." } };
  }
  const current = String(formData.get("currentPassword") ?? "");
  const [u] = await sql`SELECT password_hash FROM users WHERE id = ${userId} AND is_active`;
  if (!u?.password_hash || !current || !(await verifyPassword(u.password_hash as string, current))) {
    await audit("password_change_failed", { userId, email });
    return { errors: { currentPassword: WRONG } };
  }
  const parsed = parsePassword(formData);
  if (parsed.errors) return { errors: parsed.errors };
  if (await verifyPassword(u.password_hash as string, parsed.password)) {
    return { errors: { password: "Choose a password different from your current one." } };
  }
  await sql.transaction([
    sql`UPDATE users SET password_hash = ${await hashPassword(parsed.password)}, password_set_at = now(), updated_at = now() WHERE id = ${userId}`,
    sql`DELETE FROM sessions WHERE user_id = ${userId} AND id <> ${sessionId}`,
  ]);
  await audit("password_changed", { userId, email });
  return { changed: true };
}
