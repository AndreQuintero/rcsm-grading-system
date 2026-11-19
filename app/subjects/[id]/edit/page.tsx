import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSubject } from "@/lib/subject";
import { SubjectForm } from "../../new/SubjectForm";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";

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
  const s = Number.isInteger(n) && n > 0 ? await getSubject(n) : null;
  if (!s) notFound();
  return (
    <main>
      <PageHeader title="Edit subject" description="Renaming a subject updates it for every teacher who teaches it." action={<BackLink href="/subjects" label="Back to subjects" />} />
      <SubjectForm subjectId={n} initialName={s.name} />
    </main>
  );
}
