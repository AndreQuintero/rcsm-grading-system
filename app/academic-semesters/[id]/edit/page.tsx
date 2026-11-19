import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { getAcademicSemester, periodLabel, semesterOptions } from "@/lib/academic-semester";
import { AcademicSemesterForm } from "../../new/AcademicSemesterForm";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Year"]} radios={{ name: "Semester", count: 2 }} cards="Batches" /></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const n = Number((await params).id);
  const [s, options] = await Promise.all([Number.isInteger(n) && n > 0 ? getAcademicSemester(n) : null, semesterOptions()]);
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Edit academic semester" description={`Update ${periodLabel(s)}: its batches, teachers and their subjects.`} action={<BackLink href="/academic-semesters" label="Back to academic semesters" />} />
      <AcademicSemesterForm
        semesterId={n}
        options={options}
        initial={{ year: String(s.year), semester: String(s.semester), batchIds: s.batchIds.join(","), teachers: JSON.stringify(s.teachers) }}
      />
    </main>
  );
}
