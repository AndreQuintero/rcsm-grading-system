import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";
import { eligibleStudents } from "@/lib/batch";
import { BatchForm } from "./BatchForm";

export default function Page() {
  return (
    <main>
      <PageHeader title="Register batch" description="Set the batch number, year and semester, then choose its students." action={<BackLink href="/batches" label="Back to batches" />} />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewBatch />
      </Suspense>
    </main>
  );
}

async function NewBatch() {
  await connection(); // the available students are read per request, not baked in at build time
  const students = await eligibleStudents();
  return <BatchForm students={students} initial={{ year: String(new Date().getFullYear()) }} />;
}
