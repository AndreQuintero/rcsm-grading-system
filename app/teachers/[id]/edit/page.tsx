import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allSubjects } from "@/lib/subject";
import { getTeacher } from "@/lib/teacher";
import { TeacherForm } from "../../new/TeacherForm";
import { PageHeader } from "@/components/page-header";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main><p className="text-sm text-muted-foreground">Loading…</p></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const [t, subjects] = await Promise.all([
    Number.isInteger(n) && n > 0 ? getTeacher(n) : null,
    allSubjects(),
  ]);
  if (!t) notFound();
  return (
    <main>
      <PageHeader title="Edit teacher" description={`Update ${t.full_name}’s details and subjects.`} />
      <TeacherForm
        teacherId={n}
        initial={{ fullName: t.full_name, dateOfBirth: t.dob, email: t.email }}
        subjectOptions={subjects}
        initialSubjectIds={t.subject_ids as number[]}
      />
    </main>
  );
}
