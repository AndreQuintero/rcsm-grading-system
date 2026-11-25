import { BackLink } from "@/app/BackLink";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";

// shortcut: placeholder only, replace when the class work feature is built.
export default function Page() {
  return (
    <main>
      <PageHeader title="Class work" description="Grade the class work of your subjects." action={<BackLink href="/teacher/gradings" label="Back to gradings" />} />
      <section aria-labelledby="soon" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
        <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
        <h2 id="soon" className="mt-2 font-heading text-2xl font-bold">Coming soon</h2>
        <p className="mt-2 max-w-md text-muted-foreground">Class work grading is on its way. For now, use Final gradings.</p>
      </section>
    </main>
  );
}
