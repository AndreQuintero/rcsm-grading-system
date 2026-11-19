import { PageHeader } from "@/components/page-header";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function Page() {
  return (
    <main className="mx-auto max-w-md">
      <PageHeader title="Reset your password" description="Enter the email you sign in with and we'll send you a link to choose a new password." />
      <ForgotPasswordForm />
    </main>
  );
}
