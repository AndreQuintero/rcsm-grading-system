import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { LoginForm } from "./LoginForm";

type SearchParams = { next?: string | string[]; set?: string };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main>
      <PageHeader title="Sign in" description="Use the email the school registered for you." />
      <Suspense fallback={<FormSkeleton fields={["Email"]} />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// searchParams is request-time data, so it sits under Suspense for cacheComponents prerendering.
async function Login({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return <LoginForm next={typeof sp.next === "string" ? sp.next : ""} passwordSet={sp.set === "1"} />;
}
