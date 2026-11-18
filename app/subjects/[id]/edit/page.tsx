import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSubject } from "@/lib/subject";
import { SubjectForm } from "../../new/SubjectForm";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main><p>Loading…</p></main>}>
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
      <h1>Edit subject</h1>
      <SubjectForm subjectId={n} initialName={s.name} />
    </main>
  );
}
