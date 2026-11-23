import { createHash, randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { sql } from "@/lib/db";

// Biometric sign-in with WebAuthn passkeys: the device keeps the private key behind its fingerprint/face check and
// the server stores only the public key. Each passkey is tied to the browser that enrolled it through the httpOnly
// rcsm_device cookie, so a passkey synced to another device still needs one password sign-in there.

export const DEVICE_COOKIE = "rcsm_device";
export const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 3600; // the longest lifetime browsers allow
const CHALLENGE_MINUTES = 5;

export const deviceHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newDeviceToken = () => randomBytes(32).toString("base64url");

// The site identity comes from APP_BASE_URL, never from the request (Host headers can be forged).
function relyingParty() {
  const base = process.env.APP_BASE_URL;
  if (!base || !/^https?:\/\//.test(base)) throw new Error("APP_BASE_URL is not configured");
  const url = new URL(base);
  return { rpID: url.hostname, origin: url.origin };
}

async function saveChallenge(challenge: string, purpose: "register" | "login", userId: number | null) {
  await sql.transaction([
    sql`DELETE FROM webauthn_challenges WHERE expires_at < now()`,
    sql`INSERT INTO webauthn_challenges (challenge, user_id, purpose, expires_at)
        VALUES (${challenge}, ${userId}, ${purpose}, now() + make_interval(mins => ${CHALLENGE_MINUTES}))`,
  ]);
}

// Consumes a challenge (single use): true only if it exists, is unexpired and matches the purpose and user.
async function takeChallenge(challenge: string, purpose: "register" | "login", userId: number | null): Promise<boolean> {
  const rows = await sql`DELETE FROM webauthn_challenges
    WHERE challenge = ${challenge} AND purpose = ${purpose} AND user_id IS NOT DISTINCT FROM ${userId} AND expires_at > now()
    RETURNING 1`;
  return rows.length > 0;
}

// "Chrome on macOS" style label so the user can tell their devices apart on the account page.
export function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

// Whether any passkey (of any user) is enrolled on this device: decides if the login page offers biometrics.
export async function deviceHasPasskeys(deviceToken: string | undefined): Promise<boolean> {
  if (!deviceToken || deviceToken.length > 100) return false;
  const [r] = await sql`SELECT EXISTS (SELECT 1 FROM user_passkeys WHERE device_hash = ${deviceHash(deviceToken)}) AS e`;
  return r.e as boolean;
}

export async function userHasPasskeyOnDevice(userId: number, deviceToken: string | undefined): Promise<boolean> {
  if (!deviceToken || deviceToken.length > 100) return false;
  const [r] = await sql`SELECT EXISTS (SELECT 1 FROM user_passkeys WHERE user_id = ${userId} AND device_hash = ${deviceHash(deviceToken)}) AS e`;
  return r.e as boolean;
}

export type Passkey = { id: string; label: string; created: string; lastUsed: string | null; thisDevice: boolean };

export async function listPasskeys(userId: number, deviceToken: string | undefined): Promise<Passkey[]> {
  const hash = deviceToken ? deviceHash(deviceToken) : "";
  const rows = await sql`SELECT id, label, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS created,
      to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_used, device_hash = ${hash} AS this_device
    FROM user_passkeys WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map((r) => ({
    id: r.id as string, label: r.label as string, created: r.created as string,
    lastUsed: (r.last_used as string | null) ?? null, thisDevice: r.this_device as boolean,
  }));
}

export async function deletePasskey(userId: number, id: string): Promise<boolean> {
  return (await sql`DELETE FROM user_passkeys WHERE id = ${id} AND user_id = ${userId} RETURNING 1`).length > 0;
}

// Enrollment, step 1: options for the browser. Credentials this user already has on this device are excluded, so
// the same authenticator isn't enrolled twice.
export async function registrationOptions(user: { id: number; email: string; username: string }, deviceToken: string | undefined) {
  const { rpID } = relyingParty();
  const existing = deviceToken
    ? await sql`SELECT id, transports FROM user_passkeys WHERE user_id = ${user.id} AND device_hash = ${deviceHash(deviceToken)}`
    : [];
  const options = await generateRegistrationOptions({
    rpName: "RCSM Grading System",
    rpID,
    userName: user.email,
    userDisplayName: user.username,
    userID: new TextEncoder().encode(`rcsm-user-${user.id}`),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id as string, transports: c.transports as string[] })),
    // platform = the device's own fingerprint/face/PIN check, not a USB security key
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
  });
  await saveChallenge(options.challenge, "register", user.id);
  return options;
}

// Enrollment, step 2: verifies the browser's answer and stores the public key for this device.
export async function verifyRegistration(userId: number, response: RegistrationResponseJSON, deviceToken: string, userAgent: string): Promise<boolean> {
  const { rpID, origin } = relyingParty();
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: (c) => takeChallenge(c, "register", userId),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return false;
  }
  if (!result.verified) return false;
  const c = result.registrationInfo.credential;
  const rows = await sql`
    INSERT INTO user_passkeys (id, user_id, public_key, counter, transports, device_hash, label)
    VALUES (${c.id}, ${userId}, decode(${Buffer.from(c.publicKey).toString("base64")}, 'base64'), ${c.counter},
      ${c.transports ?? []}::text[], ${deviceHash(deviceToken)}, ${deviceLabel(userAgent)})
    ON CONFLICT (id) DO NOTHING RETURNING 1`;
  return rows.length > 0;
}

// Sign-in, step 1: only passkeys enrolled on this device may answer. Null when the device has none.
export async function authenticationOptions(deviceToken: string | undefined) {
  if (!deviceToken || deviceToken.length > 100) return null;
  const creds = await sql`SELECT id, transports FROM user_passkeys WHERE device_hash = ${deviceHash(deviceToken)}`;
  if (!creds.length) return null;
  const options = await generateAuthenticationOptions({
    rpID: relyingParty().rpID,
    allowCredentials: creds.map((c) => ({ id: c.id as string, transports: c.transports as string[] })),
    userVerification: "required",
  });
  await saveChallenge(options.challenge, "login", null);
  return options;
}

// Sign-in, step 2: the passkey must be enrolled on this device, the signature valid and its counter must not go
// backwards (a cloned authenticator). Returns the user id or null. Account rules are checked by the caller.
export async function verifyAuthentication(response: AuthenticationResponseJSON, deviceToken: string | undefined): Promise<number | null> {
  if (!deviceToken || deviceToken.length > 100 || typeof response?.id !== "string" || response.id.length > 1024) return null;
  const [p] = await sql`SELECT user_id, encode(public_key, 'base64') AS pk, counter, transports FROM user_passkeys
    WHERE id = ${response.id} AND device_hash = ${deviceHash(deviceToken)}`;
  if (!p) return null;
  const { rpID, origin } = relyingParty();
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (c) => takeChallenge(c, "login", null),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: response.id, publicKey: new Uint8Array(Buffer.from(p.pk as string, "base64")), counter: Number(p.counter), transports: p.transports as string[] },
      requireUserVerification: true,
    });
  } catch {
    return null;
  }
  if (!result.verified) return null;
  await sql`UPDATE user_passkeys SET counter = ${result.authenticationInfo.newCounter}, last_used_at = now() WHERE id = ${response.id}`;
  return p.user_id as number;
}
