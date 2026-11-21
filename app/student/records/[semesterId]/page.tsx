import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { SemesterRecord } from "@/components/records/SemesterRecord";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent, studentRecordView } from "@/lib/student-records";

export default function Page({ params }: { params: Promise<{ semesterId: string }> }) {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="My records"
        description="Your grades in every subject, with your teachers and their comments. Pick one semester or all of them."
        action={<BackLink href="/student/records" label="Back to my semesters" />}
      />
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-16 w-80" /><Skeleton className="h-48 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-[1.75rem]" /></div>}>
        <Record params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense. The student comes from the session only,
// so a semester that isn't theirs is simply not found.
async function Record({ params }: { params: Promise<{ semesterId: string }> }) {
  const [id, p] = await Promise.all([requireStudent(), params]);
  const which = p.semesterId === "all" ? "all" : Number(p.semesterId);
  if (which !== "all" && !(Number.isInteger(which) && which > 0)) notFound();
  const v = await studentRecordView(id, which);
  if (!v) notFound();
  return <SemesterRecord self view={v} base="/student/records" studentPhoto={v.student.hasPhoto ? "/student/photo" : null} teacherPhotoBase="/student/teachers" />;
}
