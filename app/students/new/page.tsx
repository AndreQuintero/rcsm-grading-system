import { StudentForm } from "./StudentForm";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Register student" description="Add a student with their study type and enrollment date." action={<BackLink href="/students" label="Back to students" />} />
      <StudentForm />
    </main>
  );
}
