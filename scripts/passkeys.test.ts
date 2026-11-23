// Library-level checks of biometric sign-in (WebAuthn passkeys) against the real database. A software P-256 key
// plays the device's authenticator. Test people use @authtest.example.com emails and are removed at the end.
import assert from "node:assert/strict";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import { sql } from "../lib/db";
import { syncUserFromRoleTables } from "../lib/auth/sync";
import {
  authenticationOptions, deletePasskey, deviceHasPasskeys, deviceHash, deviceLabel, listPasskeys, registrationOptions,
  userHasPasskeyOnDevice, verifyAuthentication,
} from "../lib/auth/passkey";

const D = "@authtest.example.com";
const ORIGIN = "https://app.example.test";
process.env.APP_BASE_URL = ORIGIN;
const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const challenges: string[] = [];

const cleanup = async () => {
  await sql`DELETE FROM teachers WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM users WHERE email LIKE ${"%" + D}`; // cascades passkeys, enrollment challenges, sessions
  await sql`DELETE FROM auth_audit WHERE email LIKE ${"%" + D}`;
  await sql`DELETE FROM webauthn_challenges WHERE challenge = ANY(${challenges})`;
};

// The authenticator: signs authenticatorData || SHA-256(clientDataJSON) with its private key.
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
// COSE EC2 key {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}, CBOR-encoded
const cose = Buffer.concat([
  Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]), Buffer.from(jwk.x!, "base64url"),
  Buffer.from([0x22, 0x58, 0x20]), Buffer.from(jwk.y!, "base64url"),
]);
const credId = b64u(randomBytes(16));

function answer(challenge: string, counter: number, flags = 0x05 /* user present + user verified */) {
  const counterBytes = Buffer.alloc(4);
  counterBytes.writeUInt32BE(counter);
  const authData = Buffer.concat([createHash("sha256").update(new URL(ORIGIN).hostname).digest(), Buffer.from([flags]), counterBytes]);
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: ORIGIN }));
  const signature = createSign("SHA256").update(Buffer.concat([authData, createHash("sha256").update(clientData).digest()])).sign(privateKey);
  return {
    id: credId, rawId: credId, type: "public-key" as const, clientExtensionResults: {},
    response: { clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(signature) },
  };
}
async function options(device: string) {
  const o = await authenticationOptions(device);
  assert.ok(o, "options for an enrolled device");
  challenges.push(o.challenge);
  return o;
}

async function main() {
  await cleanup();
  try {
    const email = `pk-teacher${D}`;
    await sql`INSERT INTO teachers (full_name, date_of_birth, email) VALUES ('Passkey Tester', '1980-01-01', ${email})`;
    await syncUserFromRoleTables(email);
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    const userId = u.id as number;
    const device = b64u(randomBytes(32)), other = b64u(randomBytes(32));

    // no passkey yet: the login page offers nothing
    assert.equal(await authenticationOptions(undefined), null);
    assert.equal(await authenticationOptions(device), null);
    assert.equal(await deviceHasPasskeys(device), false);

    await sql`INSERT INTO user_passkeys (id, user_id, public_key, device_hash, label)
      VALUES (${credId}, ${userId}, decode(${cose.toString("base64")}, 'base64'), ${deviceHash(device)}, 'Chrome on macOS')`;
    assert.equal(await deviceHasPasskeys(device), true);
    assert.equal(await deviceHasPasskeys(other), false, "another browser has no passkey");
    assert.equal(await userHasPasskeyOnDevice(userId, device), true);
    assert.equal(await authenticationOptions(other), null, "a synced passkey still needs the device cookie");

    // a valid signature signs in and moves the counter
    let o = await options(device);
    assert.deepEqual(o.allowCredentials?.map((c) => c.id), [credId]);
    const first = answer(o.challenge, 1);
    assert.equal(await verifyAuthentication(first, device), userId);
    const [p] = await sql`SELECT counter, last_used_at IS NOT NULL AS used FROM user_passkeys WHERE id = ${credId}`;
    assert.equal(Number(p.counter), 1);
    assert.equal(p.used, true);

    assert.equal(await verifyAuthentication(first, device), null, "a challenge is used once");

    o = await options(device);
    assert.equal(await verifyAuthentication(answer(o.challenge, 1), device), null, "a counter that doesn't move up is refused");

    o = await options(device);
    assert.equal(await verifyAuthentication(answer(o.challenge, 5), other), null, "wrong device cookie is refused");

    o = await options(device);
    assert.equal(await verifyAuthentication(answer(o.challenge, 6, 0x01), device), null, "no fingerprint/face check (UV) is refused");

    assert.equal(await verifyAuthentication(answer(b64u(randomBytes(32)), 7), device), null, "an unknown challenge is refused");

    o = await options(device);
    const forged = answer(o.challenge, 8);
    forged.response.signature = answer(o.challenge, 9).response.signature;
    assert.equal(await verifyAuthentication(forged, device), null, "a signature over other data is refused");

    // an expired challenge is refused
    o = await options(device);
    await sql`UPDATE webauthn_challenges SET expires_at = now() - interval '1 second' WHERE challenge = ${o.challenge}`;
    assert.equal(await verifyAuthentication(answer(o.challenge, 10), device), null, "an expired challenge is refused");

    // enrollment options exclude what this device already has, and bind the challenge to the user
    const reg = await registrationOptions({ id: userId, email, username: "Passkey Tester" }, device);
    challenges.push(reg.challenge);
    assert.deepEqual(reg.excludeCredentials?.map((c) => c.id), [credId]);
    assert.equal(reg.rp.id, "app.example.test");
    assert.equal(reg.authenticatorSelection?.userVerification, "required");
    const [ch] = await sql`SELECT user_id, purpose FROM webauthn_challenges WHERE challenge = ${reg.challenge}`;
    assert.equal(ch.user_id, userId);
    assert.equal(ch.purpose, "register");

    const list = await listPasskeys(userId, device);
    assert.equal(list.length, 1);
    assert.equal(list[0].thisDevice, true);
    assert.equal((await listPasskeys(userId, other))[0].thisDevice, false);

    assert.equal(await deletePasskey(userId + 1_000_000, credId), false, "only the owner removes a passkey");
    assert.equal(await deletePasskey(userId, credId), true);
    assert.equal(await deviceHasPasskeys(device), false);

    assert.equal(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"), "Chrome on macOS");
    assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), "Safari on iPhone");
    assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0"), "Edge on Windows");
    assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36"), "Chrome on Android");

    console.log("passkeys: all checks passed");
  } finally {
    await cleanup();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
