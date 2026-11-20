import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { SemesterCards } from "@/components/records/SemesterCards";
import { StudentHero } from "@/components/records/StudentHero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { studentSemesters } from "@/lib/student-records";

const header = <PageHeader title="Student record" description="The semesters this student takes part in. Open one to see its grades." action={<BackLink href="/student-records" label="Back to student records" />} />;

export default function Page({ params }: { params: Promise<{ studentId: string }> }) {
  return (
    <main className="flex flex-col gap-6">
      {header}
      <Suspense fallback={<div className="flex flex-col gap-6" aria-busy="true"><span role="status" className="sr-only">Loading</span><Skeleton className="h-48 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-[1.75rem]" /></div>}>
        <Semesters params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Semesters({ params }: { params: Promise<{ studentId: string }> }) {
  await requireRole("admin");
  const id = Number((await params).studentId);
  const r = Number.isInteger(id) && id > 0 ? await studentSemesters(id) : null;
  if (!r) notFound();

  return (
    <>
      <StudentHero student={r} photo={r.hasPhoto ? `/students/${r.id}/photo` : null} lottie="calendar-booking" />
      <SemesterCards
        semesters={r.semesters}
        base={`/student-records/${r.id}`}
        empty={
          <>
          <h2 id="no-semesters" className="mt-2 font-heading text-2xl font-bold">No semesters yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            {r.batch ? `The ${r.batch} isn't in any academic semester yet.` : "This student has no batch, so they aren't in any academic semester yet."} Add their batch to a semester to start their record.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/academic-semesters"><CalendarRange aria-hidden="true" />Go to Semesters</Link>
          </Button>
          </>
        }
      />
    </>
  );
}
