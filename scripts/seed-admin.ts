// Usage: npx tsx scripts/seed-admin.ts --name "Full Name" --email you@example.com --dob 1990-01-31
// Registers an admin outside the app (the first admin cannot be created in the UI before anyone can sign in),
// then syncs their account. They sign in at /login with that email to receive the set-password link.
import { insertAdmin } from "../lib/admin";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

(async () => {
  const f = new FormData();
  f.set("fullName", arg("name") ?? "");
  f.set("email", arg("email") ?? "");
  f.set("dateOfBirth", arg("dob") ?? "");
  const r = await insertAdmin(f);
  if (r.errors) {
    console.error("NOT SEEDED:", Object.values(r.errors).join(" "));
    process.exit(1);
  }
  console.log(r.message, "They can now request their set-password link at /login.");
})().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
