import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";
import { batchLabel, eligibleStudents, getBatch } from "@/lib/batch";
import { BatchForm } from "../../new/BatchForm";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Batch number", "Year"]} radios={{ name: "Semester", count: 2 }} cards="Students" /></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const b = Number.isInteger(n) && n > 0 ? await getBatch(n) : null;
  if (!b) notFound();
  const students = await eligibleStudents(n);
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Edit batch" description={`Update the ${batchLabel(b as { number: number; year: number; semester: number })} and its students.`} action={<BackLink href="/batches" label="Back to batches" />} />
      <BatchForm
        batchId={n}
        students={students}
        initial={{
          number: String(b.number),
          year: String(b.year),
          semester: String(b.semester),
          studentIds: (b.student_ids as number[]).join(","),
        }}
      />
    </main>
  );
}
