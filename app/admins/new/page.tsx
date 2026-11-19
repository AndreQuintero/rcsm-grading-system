import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/app/BackLink";
import { AdminForm } from "./AdminForm";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Register admin" description="Add someone who can manage the system." action={<BackLink href="/admins" label="Back to admins" />} />
      <AdminForm />
    </main>
  );
}
