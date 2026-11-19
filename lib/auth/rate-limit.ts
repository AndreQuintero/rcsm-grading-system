import { headers } from "next/headers";
import { sql } from "@/lib/db";

export const RATE_MAX = 5;
export const RATE_WINDOW_MINUTES = 15;

// Counts one attempt for key in a fixed window (atomic upsert). Returns false once the limit is passed.
export async function hit(key: string, max = RATE_MAX, windowMinutes = RATE_WINDOW_MINUTES): Promise<boolean> {
  const [row] = await sql`
    INSERT INTO auth_rate_limits AS l (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN l.window_start <= now() - make_interval(mins => ${windowMinutes}) THEN 1 ELSE l.count + 1 END,
      window_start = CASE WHEN l.window_start <= now() - make_interval(mins => ${windowMinutes}) THEN now() ELSE l.window_start END
    RETURNING count`;
  return (row.count as number) <= max;
}

// Both the IP and the email are counted on every attempt; either one over the limit blocks.
export async function allowAttempt(step: "email" | "password", ip: string, email: string): Promise<boolean> {
  const [byIp, byEmail] = await Promise.all([hit(`${step}:ip:${ip}`), hit(`${step}:email:${email}`)]);
  return byIp && byEmail;
}

// Vercel sets x-forwarded-for itself; outside Vercel the header is client-controlled.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}
