import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { allSubjects } from "@/lib/subject";
import { TeacherForm } from "./TeacherForm";
import { PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <main>
      <PageHeader title="Register teacher" description="Add a teacher and choose the subjects they teach." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
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
      <Card className="max-w-3xl">
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            No subjects are registered yet. A teacher needs at least one subject, so register the subjects first.
          </p>
          <Button asChild>
            <Link href="/subjects/new">Register subjects</Link>
          </Button>
        </CardContent>
      </Card>
    );
  return <TeacherForm subjectOptions={subjects} />;
}
