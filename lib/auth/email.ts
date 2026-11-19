import { appendFileSync } from "node:fs";

// Sends the password-link email through EmailJS with one shared template (params: email, link, name, subject).
// EMAIL_TRANSPORT=outbox writes the message to EMAIL_OUTBOX_FILE instead, for local tests only.
export async function sendSetupEmail({ to, name, link, subject }: { to: string; name: string; link: string; subject: string }): Promise<void> {
  if (process.env.EMAIL_TRANSPORT === "outbox") {
    if (process.env.VERCEL || !process.env.EMAIL_OUTBOX_FILE) throw new Error("The outbox email transport is for local tests only");
    appendFileSync(process.env.EMAIL_OUTBOX_FILE, JSON.stringify({ to, name, link, subject }) + "\n");
    return;
  }
  const env = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} is not configured`);
    return v;
  };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      service_id: env("EMAILJS_SERVICE_ID"),
      template_id: env("EMAILJS_TEMPLATE_ID"),
      user_id: env("EMAILJS_PUBLIC_KEY"),
      accessToken: env("EMAILJS_PRIVATE_KEY"),
      template_params: { email: to, link, name, subject },
    }),
  });
  // The response body is not included: it could echo the link.
  if (!res.ok) throw new Error(`EmailJS send failed with status ${res.status}`);
}
