import { SubjectForm } from "./SubjectForm";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Register subjects" description="Add one or more subjects at once. Empty rows are skipped." action={<BackLink href="/subjects" label="Back to subjects" />} />
      <SubjectForm />
    </main>
  );
}
