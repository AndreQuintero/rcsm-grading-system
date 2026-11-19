import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { getAccount } from "@/lib/auth/account";
import { getSession } from "@/lib/auth/session";
import { AccountForm } from "./AccountForm";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Your account" description="Your profile picture, name and password." />
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
  const a = await getAccount(s.userId);
  if (!a) redirect("/login");
  return (
    <div className="flex flex-col gap-8">
      <AccountForm
        username={a.username as string}
        email={a.email as string}
        created={a.created as string}
        photoUrl={a.has_photo ? `/account/photo?v=${s.photoVersion}` : null}
      />
      <ChangePasswordForm />
    </div>
  );
}
