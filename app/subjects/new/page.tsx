import { SubjectForm } from "./SubjectForm";
import { PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <main>
      <PageHeader title="Register subjects" description="Add one or more subjects at once. Empty rows are skipped." />
      <SubjectForm />
    </main>
  );
}
