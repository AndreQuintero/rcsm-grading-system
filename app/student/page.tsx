import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { HeaderSkeleton } from "@/components/skeletons";
import { requireRole } from "@/lib/auth/session";

// Student home. shortcut: placeholder only; the student's grades live in My records (/student/records).
export default function Page() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const s = await requireRole("student");
  return (
    <main>
      <PageHeader title={`Welcome, ${s.username}`} description="Your student area. Your grades are in My records." />
    </main>
  );
}
