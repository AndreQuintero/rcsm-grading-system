import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";
import { getAdmin } from "@/lib/admin";
import { AdminForm } from "../../new/AdminForm";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main><p className="text-sm text-muted-foreground">Loading…</p></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const a = Number.isInteger(n) && n > 0 ? await getAdmin(n) : null;
  if (!a) notFound();
  return (
    <main>
      <PageHeader title="Edit admin" description={`Update ${a.full_name}’s details.`} action={<BackLink href="/admins" label="Back to admins" />} />
      <AdminForm adminId={n} initial={{ fullName: a.full_name, dateOfBirth: a.dob, email: a.email }} />
    </main>
  );
}
