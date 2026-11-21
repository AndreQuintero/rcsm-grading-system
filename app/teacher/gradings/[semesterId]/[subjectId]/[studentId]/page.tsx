import { Mail } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { Avatar } from "@/app/_dashboard/Avatar";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { periodLabel } from "@/lib/academic-semester";
import { formatDate } from "@/lib/dates";
import { requireTeacher, studentGrading, subjectGrading, teaches } from "@/lib/grading";
import { GradeForm } from "./GradeForm";

type Params = { semesterId: string; subjectId: string; studentId: string };

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl"><HeaderSkeleton /><FormSkeleton fields={["Midterm exam", "Participation", "Presence", "Final exam"]} /></main>}>
      <Student params={params} />
    </Suspense>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Student({ params }: { params: Promise<Params> }) {
  const [{ teacherId }, p] = await Promise.all([requireTeacher(), params]);
  const [semesterId, subjectId, studentId] = [p.semesterId, p.subjectId, p.studentId].map(Number);
  if (![semesterId, subjectId, studentId].every(Number.isInteger) || !(await teaches(semesterId, subjectId, teacherId))) notFound();
  const [s, subject] = await Promise.all([studentGrading(semesterId, subjectId, studentId), subjectGrading(semesterId, subjectId)]);
  if (!s || !subject) notFound();
  const saved = s.updated ? `Last saved by ${s.updatedBy ?? "a former user"} on ${formatDate(s.updated)} UTC` : null;

  return (
    <main className="mx-auto max-w-4xl">
      <PageHeader
        title={`${subject.subject} grades`}
        description={periodLabel(subject.period)}
        action={<BackLink href={`/teacher/gradings/${semesterId}/${subjectId}`} label={`Back to ${subject.subject}`} />}
      />
      <div className="grid gap-6 md:grid-cols-[17rem_1fr]">
        <section aria-labelledby="student" className="flex flex-col items-center gap-3 self-start rounded-[1.75rem] border border-border/70 bg-card p-6 text-center">
          <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-28 ring-4 ring-accent" />
          <h2 id="student" className="font-heading text-2xl font-bold leading-tight">{s.name}</h2>
          <StatusBadge status={s.status} />
          <dl className="mt-2 w-full space-y-3 border-t border-border/70 pt-4 text-left text-sm">
            <div><dt className="text-muted-foreground">Age</dt><dd className="font-medium">{s.age} years old</dd></div>
            <div><dt className="text-muted-foreground">Batch</dt><dd className="font-medium">{s.batch}</dd></div>
            {s.email && (
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd><a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 break-all text-primary underline-offset-4 hover:underline"><Mail className="size-4 shrink-0" aria-hidden="true" />{s.email}</a></dd>
              </div>
            )}
          </dl>
        </section>
        <section aria-label="Grades" className="rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8">
          <GradeForm semesterId={semesterId} subjectId={subjectId} studentId={s.id} grades={s.grades} comment={s.comment} saved={saved} />
        </section>
      </div>
    </main>
  );
}
