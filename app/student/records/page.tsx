import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SemesterCards } from "@/components/records/SemesterCards";
import { StudentHero } from "@/components/records/StudentHero";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent, studentSemesters } from "@/lib/student-records";

export default function Page() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="My records" description="Your grades, semester by semester. Open one, or all of them at once." />
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-48 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-[1.75rem]" /></div>}>
        <Semesters />
      </Suspense>
    </main>
  );
}

// The session is request-time data, so it sits under Suspense (cacheComponents). The student comes from the session only.
async function Semesters() {
  const id = await requireStudent();
  const r = await studentSemesters(id);
  if (!r) return null;
  return (
    <>
      <StudentHero student={r} photo={r.hasPhoto ? "/student/photo" : null} lottie="calendar-booking" />
      <SemesterCards
        self
        semesters={r.semesters}
        base="/student/records"
        empty={
          <>
            <h2 id="no-semesters" className="mt-2 font-heading text-2xl font-bold">No semesters yet</h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              You&apos;re not in an academic semester yet. Your records appear here once your batch is added to one.
            </p>
          </>
        }
      />
    </>
  );
}
