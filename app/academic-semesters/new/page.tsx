import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { semesterOptions } from "@/lib/academic-semester";
import { AcademicSemesterForm } from "./AcademicSemesterForm";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Register academic semester" description="Set the year and semester, choose its batches, then add its teachers and their subjects." action={<BackLink href="/academic-semesters" label="Back to academic semesters" />} />
      <Suspense fallback={<FormSkeleton fields={["Year"]} radios={{ name: "Semester", count: 2 }} cards="Batches" />}>
        <NewSemester />
      </Suspense>
    </main>
  );
}

async function NewSemester() {
  await connection(); // the batches, teachers and subjects are read per request, not baked in at build time
  return <AcademicSemesterForm options={await semesterOptions()} initial={{ year: String(new Date().getFullYear()) }} />;
}
