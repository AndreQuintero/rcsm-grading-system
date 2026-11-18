import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getStudent } from "@/lib/student-queries";
import { StudentForm } from "../../new/StudentForm";
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
  const s = Number.isInteger(n) && n > 0 ? await getStudent(n) : null;
  if (!s) notFound();
  return (
    <main>
      <PageHeader title="Edit student" description={`Update ${[s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ")}’s details.`} />
      <StudentForm
        studentId={n}
        hasPhoto={s.has_photo as boolean}
        initial={{
          firstName: s.first_name,
          middleName: s.middle_name ?? "",
          lastName: s.last_name,
          dateOfBirth: s.dob,
          status: s.status,
          enrollmentDate: s.enrolled,
        }}
      />
    </main>
  );
}
