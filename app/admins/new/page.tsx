import { PageHeader } from "@/components/page-header";
import { AdminForm } from "./AdminForm";

export default function Page() {
  return (
    <main>
      <PageHeader title="Register admin" description="Add someone who can manage the system." />
      <AdminForm />
    </main>
  );
}
