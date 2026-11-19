import { TeacherForm } from "./TeacherForm";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Register teacher" description="Add a teacher. The subjects they teach are set per academic semester." action={<BackLink href="/teachers" label="Back to teachers" />} />
      <TeacherForm />
    </main>
  );
}
