-- Biometric sign-in (WebAuthn passkeys). Additive: safe to apply before the deploy that uses it.

-- One row per enrolled device. device_hash = SHA-256 of the rcsm_device cookie set on that device at enrollment:
-- a passkey signs in only from the browser holding that cookie, so a synced passkey still needs a password sign-in
-- on each new device.
CREATE TABLE IF NOT EXISTS user_passkeys (
  id text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_hash text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_passkeys_user_idx ON user_passkeys (user_id);
CREATE INDEX IF NOT EXISTS user_passkeys_device_idx ON user_passkeys (device_hash);

-- One-time challenges (5 minutes). user_id is set for enrollment, NULL for sign-in.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge text PRIMARY KEY,
  user_id int REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at timestamptz NOT NULL
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'password' CHECK (method IN ('password', 'passkey'));
