import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { SemesterRecord } from "@/components/records/SemesterRecord";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { studentRecordView } from "@/lib/student-records";

type Params = { studentId: string; semesterId: string };

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-16 w-80" /><Skeleton className="h-48 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-[1.75rem]" /></div>}>
        <Record params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Record({ params }: { params: Promise<Params> }) {
  await requireRole("admin");
  const p = await params;
  const id = Number(p.studentId);
  // "all" = every semester of the student in one record; otherwise one semester id
  const which = p.semesterId === "all" ? "all" : Number(p.semesterId);
  if (!Number.isInteger(id) || id < 1 || (which !== "all" && !(Number.isInteger(which) && which > 0))) notFound();
  const v = await studentRecordView(id, which);
  if (!v) notFound();

  return (
    <>
      <PageHeader
        title="Student record"
        description="This student's grades in every subject, with the teachers who teach them. Pick one semester or all of them."
        action={<BackLink href={`/student-records/${id}`} label="Back to this student's semesters" />}
      />
      <SemesterRecord
        view={v}
        base={`/student-records/${id}`}
        studentPhoto={v.student.hasPhoto ? `/students/${id}/photo` : null}
        teacherPhotoBase="/teachers"
      />
    </>
  );
}
