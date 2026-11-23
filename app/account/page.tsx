import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { getAccount } from "@/lib/auth/account";
import { DEVICE_COOKIE, listPasskeys } from "@/lib/auth/passkey";
import { getSession } from "@/lib/auth/session";
import { AccountForm } from "./AccountForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { Passkeys } from "./Passkeys";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Your account" description="Your profile picture, name, password and biometric sign-in." />
      <Suspense fallback={<FormSkeleton fields={["Username", "Email"]} photo />}>
        <Account />
      </Suspense>
    </main>
  );
}

// The session is request data, so it sits under Suspense for cacheComponents prerendering.
async function Account() {
  const s = await getSession();
  if (!s) redirect("/login?next=/account");
  const [a, passkeys] = await Promise.all([getAccount(s.userId), listPasskeys(s.userId, (await cookies()).get(DEVICE_COOKIE)?.value)]);
  if (!a) redirect("/login");
  return (
    <div className="flex flex-col gap-8">
      <AccountForm
        username={a.username as string}
        email={a.email as string}
        created={a.created as string}
        photoUrl={a.has_photo ? `/account/photo?v=${s.photoVersion}` : null}
        roles={s.roles}
      />
      <ChangePasswordForm />
      <Passkeys passkeys={passkeys} canEnroll={s.method === "password"} />
    </div>
  );
}
