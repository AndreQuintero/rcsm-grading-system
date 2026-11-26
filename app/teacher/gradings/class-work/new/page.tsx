import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { periodLabel } from "@/lib/academic-semester";
import { pickDefault } from "@/lib/dashboard";
import { todayIso } from "@/lib/dates";
import { requireTeacher, teacherSemesters } from "@/lib/grading";
import { MeetingForm } from "./MeetingForm";

export default function Page({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Name", "Date"]} /></main>}>
      <New searchParams={searchParams} />
    </Suspense>
  );
}

// The session and searchParams are request-time data, so they sit under Suspense (cacheComponents).
async function New({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  const [{ teacherId }, sp] = await Promise.all([requireTeacher(), searchParams]);
  const choices = await teacherSemesters(teacherId);
  const s = choices.find((c) => String(c.id) === sp.semester) ?? pickDefault(choices);
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Register weekly meeting" description={`A weekly meeting of ${periodLabel(s)}.`}
        action={<BackLink href={`/teacher/gradings/class-work?semester=${s.id}`} label="Back to class work" />} />
      <MeetingForm semesterId={s.id} period={periodLabel(s)} initial={{ heldOn: todayIso() }} />
    </main>
  );
}
