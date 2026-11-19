import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { SetPasswordForm } from "./SetPasswordForm";

// Rendering this page never reads or uses the token (email scanners open links); only submitting the form does.
export default function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  return (
    <main>
      <PageHeader title="Set your password" description="Choose the password you'll use to sign in." />
      <Suspense fallback={<FormSkeleton fields={["New password", "Confirm password"]} />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <SetPasswordForm token={typeof token === "string" ? token.slice(0, 100) : ""} />;
}
