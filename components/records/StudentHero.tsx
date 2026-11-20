import { Mail } from "lucide-react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { LottiePlayer, type AnimationName } from "@/components/lottie-player";
import { StatusBadge } from "@/components/status-badge";

type Student = { name: string; status: string; age: number; batch: string | null; email: string | null };

// The student card at the top of a record page: photo, name, status, age, batch, email, and a decorative Lottie.
export function StudentHero({ student: s, photo, lottie }: { student: Student; photo: string | null; lottie: AnimationName }) {
  return (
    <section aria-labelledby="student" className="grid items-center gap-6 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8 md:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar src={photo} className="size-24 ring-4 ring-accent" />
        <div className="min-w-0">
          <h2 id="student" className="font-heading text-3xl font-bold leading-tight">{s.name}</h2>
          <div className="mt-2"><StatusBadge status={s.status} /></div>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Age</dt><dd className="font-medium">{s.age} years old</dd></div>
            <div><dt className="text-muted-foreground">Batch</dt><dd className="font-medium">{s.batch ?? "No batch"}</dd></div>
            {s.email && (
              <div className="min-w-0">
                <dt className="text-muted-foreground">Email</dt>
                <dd><a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 break-all text-primary underline-offset-4 hover:underline"><Mail className="size-4 shrink-0" aria-hidden="true" />{s.email}</a></dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <LottiePlayer name={lottie} className="hidden size-48 md:block lg:size-56" />
    </section>
  );
}
