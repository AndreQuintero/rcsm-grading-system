import { StudentForm } from "./StudentForm";
import { PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <main>
      <PageHeader title="Register student" description="Add a student with their study type and enrollment date." />
      <StudentForm />
    </main>
  );
}
