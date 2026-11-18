import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTeacher } from "@/lib/teacher";
import { TeacherForm } from "../../new/TeacherForm";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main><p>Loading…</p></main>}>
      <Edit params={params} />
    </Suspense>
  );
}

// params is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const t = Number.isInteger(n) && n > 0 ? await getTeacher(n) : null;
  if (!t) notFound();
  return (
    <main>
      <h1>Edit teacher</h1>
      <TeacherForm
        teacherId={n}
        initial={{
          fullName: t.full_name,
          dateOfBirth: t.dob,
          email: t.email,
          subjects: (t.subjects as string[]).join("\n"),
        }}
      />
    </main>
  );
}
