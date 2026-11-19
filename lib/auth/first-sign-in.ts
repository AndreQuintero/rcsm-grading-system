import { sql } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { sendSetupEmail } from "@/lib/auth/email";
import { syncUserFromRoleTables } from "@/lib/auth/sync";
import { issueSetupToken, setupLink, type TokenPurpose } from "@/lib/auth/tokens";

// The subject of the shared EmailJS template ({{subject}}), per flow.
export const EMAIL_SUBJECT: Record<TokenPurpose, string> = { setup: "First Login RCSM", reset: "Reset password - RCSM" };

// Issues a link of the given purpose and emails it (within the email limits: 1 per 5 min, 5 per day).
async function sendPasswordLink(user: { id: number; username: string }, email: string, purpose: TokenPurpose): Promise<"sent" | "none"> {
  const token = await issueSetupToken(user.id, purpose);
  if (!token) return "none";
  const kind = purpose === "reset" ? "reset" : "setup";
  try {
    await sendSetupEmail({ to: email, name: user.username, link: setupLink(token), subject: EMAIL_SUBJECT[purpose] });
  } catch (e) {
    await audit(`${kind}_email_failed`, { userId: user.id, email });
    throw e;
  }
  await audit(`${kind}_email_sent`, { userId: user.id, email });
  return "sent";
}

// Login step 1 work, run after the response is sent: sync the person from the role tables, and if they are
// active with no password yet, email a first sign-in link.
export async function startFirstSignIn(email: string): Promise<"sent" | "none"> {
  await syncUserFromRoleTables(email);
  const [u] = await sql`SELECT id, username FROM users WHERE email = ${email} AND is_active AND password_hash IS NULL`;
  return u ? sendPasswordLink({ id: u.id as number, username: u.username as string }, email, "setup") : "none";
}

// "I forgot my password" work, run after the response is sent: an active account with a password gets a reset
// link; one that never set a password gets the first sign-in link instead. Unknown or inactive: nothing.
export async function startPasswordReset(email: string): Promise<"sent" | "none"> {
  await syncUserFromRoleTables(email);
  const [u] = await sql`SELECT id, username, password_hash IS NOT NULL AS has_password FROM users WHERE email = ${email} AND is_active`;
  if (!u) return "none";
  return sendPasswordLink({ id: u.id as number, username: u.username as string }, email, u.has_password ? "reset" : "setup");
}
