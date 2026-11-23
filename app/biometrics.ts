import { platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser";
import { finishPasskeyEnrollment, startPasskeyEnrollment } from "./account/passkey-actions";

// Browser side of biometric sign-in, shared by the login button, the after-sign-in offer and the account page.

// True when this device has a built-in check WebAuthn can use (Touch ID, Face ID, Windows Hello, Android
// fingerprint...). The browser can't say whether that check is a fingerprint, a face or the device PIN.
export async function biometricsAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export const cancelled = (e: unknown) => e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");

// Enrolls this device for the signed-in user. Returns an error message, or null when it worked.
export async function enrollThisDevice(): Promise<string | null> {
  const start = await startPasskeyEnrollment();
  if (start.error || !start.options) return start.error ?? "Something went wrong. Please try again.";
  let response;
  try {
    response = await startRegistration({ optionsJSON: start.options });
  } catch (e) {
    return cancelled(e) ? "The fingerprint or face check was cancelled." : "This device couldn't turn on biometric sign-in.";
  }
  return (await finishPasskeyEnrollment(response)).error ?? null;
}
