import { sql } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { sendSetupEmail } from "@/lib/auth/email";
import { syncUserFromRoleTables } from "@/lib/auth/sync";
import { issueSetupToken, setupLink } from "@/lib/auth/tokens";

// Login step 1 work, run after the response is sent: sync the person from the role tables, and if they are
// active with no password yet, issue a setup token and email the link (within the email limits).
export async function startFirstSignIn(email: string): Promise<"sent" | "none"> {
  await syncUserFromRoleTables(email);
  const [u] = await sql`SELECT id, username FROM users WHERE email = ${email} AND is_active AND password_hash IS NULL`;
  if (!u) return "none";
  const token = await issueSetupToken(u.id as number);
  if (!token) return "none";
  try {
    await sendSetupEmail({ to: email, name: u.username as string, link: setupLink(token) });
  } catch (e) {
    await audit("setup_email_failed", { userId: u.id as number, email });
    throw e;
  }
  await audit("setup_email_sent", { userId: u.id as number, email });
  return "sent";
}
