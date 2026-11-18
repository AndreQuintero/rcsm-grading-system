import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { allSubjects } from "@/lib/subject";
import { TeacherForm } from "./TeacherForm";

export default function Page() {
  return (
    <main>
      <h1>Register teacher</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewTeacher />
      </Suspense>
    </main>
  );
}

async function NewTeacher() {
  await connection(); // the subject list is read per request, not baked in at build time
  const subjects = await allSubjects();
  if (subjects.length === 0)
    return (
      <p>
        No subjects are registered yet. <Link href="/subjects/new">Register subjects</Link> first.
      </p>
    );
  return <TeacherForm subjectOptions={subjects} />;
}
