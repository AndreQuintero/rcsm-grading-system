import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons";
import { periodLabel } from "@/lib/academic-semester";
import { getMeeting } from "@/lib/class-work";
import { requireTeacher } from "@/lib/grading";
import { MeetingForm } from "../../new/MeetingForm";

export default function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl"><HeaderSkeleton /><FormSkeleton fields={["Name", "Date"]} /></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Edit({ params }: { params: Promise<{ meetingId: string }> }) {
  const [{ teacherId }, p] = await Promise.all([requireTeacher(), params]);
  const id = Number(p.meetingId);
  const m = Number.isInteger(id) && id > 0 ? await getMeeting(teacherId, id) : null;
  if (!m) notFound();
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Edit weekly meeting" description={`Update ${m.name}.`}
        action={<BackLink href={`/teacher/gradings/class-work?semester=${m.semesterId}`} label="Back to class work" />} />
      <MeetingForm semesterId={m.semesterId} period={periodLabel(m.period)} meetingId={m.id} initial={{ name: m.name, heldOn: m.heldOn }} />
    </main>
  );
}
