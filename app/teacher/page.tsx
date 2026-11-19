import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { HeaderSkeleton } from "@/components/skeletons";
import { requireRole } from "@/lib/auth/session";

// Teacher home. shortcut: placeholder only; the teacher area's real pages come later.
export default function Page() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const s = await requireRole("teacher");
  return (
    <main>
      <PageHeader title={`Welcome, ${s.username}`} description="Your teacher area. More is coming soon." />
    </main>
  );
}
