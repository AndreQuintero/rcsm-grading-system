import { cookies } from "next/headers";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { DEVICE_COOKIE, deviceHasPasskeys } from "@/lib/auth/passkey";
import { LoginForm } from "./LoginForm";

type SearchParams = { next?: string | string[]; set?: string };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="mx-auto max-w-md">
      <PageHeader title="Sign in" description="Use the email the school registered for you." />
      <Suspense fallback={<FormSkeleton fields={["Email"]} />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// searchParams and cookies are request-time data, so it sits under Suspense for cacheComponents prerendering.
async function Login({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, jar] = await Promise.all([searchParams, cookies()]);
  const biometric = await deviceHasPasskeys(jar.get(DEVICE_COOKIE)?.value);
  return <LoginForm next={typeof sp.next === "string" ? sp.next : ""} passwordSet={sp.set === "1"} biometric={biometric} />;
}
