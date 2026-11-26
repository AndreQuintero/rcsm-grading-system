import { Eye, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SemesterSelect } from "@/app/_dashboard/SemesterSelect";
import { BackLink } from "@/app/BackLink";
import { ConfirmDeleteButton } from "@/app/ConfirmDeleteButton";
import { EditLink } from "@/app/EditLink";
import { EmptyAnimation } from "@/components/empty-animation";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { periodLabel } from "@/lib/academic-semester";
import { batchPeriod } from "@/lib/batch";
import { listMeetings } from "@/lib/class-work";
import { CLASS_WORK_PAGE_SIZE } from "@/lib/class-work-shared";
import { periodKey, pickDefault } from "@/lib/dashboard";
import { formatDate, todayIso } from "@/lib/dates";
import { requireTeacher, teacherSemesters } from "@/lib/grading";
import { deleteMeetingAction } from "./actions";

type SearchParams = { semester?: string; page?: string };
const BASE = "/teacher/gradings/class-work";

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main>
      <Suspense
        fallback={
          <div className="flex flex-col gap-6" aria-busy="true">
            <span role="status" className="sr-only">Loading</span>
            <Skeleton className="h-16 w-80 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        }
      >
        <Meetings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// The session and searchParams are request-time data, so they sit under Suspense (cacheComponents).
async function Meetings({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ teacherId }, sp] = await Promise.all([requireTeacher(), searchParams]);
  const choices = await teacherSemesters(teacherId);
  const selected = choices.find((c) => String(c.id) === sp.semester) ?? pickDefault(choices);
  const back = <BackLink href="/teacher/gradings" label="Back to gradings" />;

  if (!selected)
    return (
      <>
        <PageHeader title="Class work" description="Your weekly meetings and their class work grades." action={back} />
        <section aria-labelledby="no-semester" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
          <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
          <h2 id="no-semester" className="mt-2 font-heading text-2xl font-bold">No semester assigned to you yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">Once an admin adds you to an academic semester, you can register its weekly meetings here.</p>
        </section>
      </>
    );

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { meetings, total } = await listMeetings(teacherId, selected.id, page);
  const pages = Math.max(1, Math.ceil(total / CLASS_WORK_PAGE_SIZE));
  const pageHref = (p: number) => `${BASE}?semester=${selected.id}${p > 1 ? `&page=${p}` : ""}`;
  const nowKey = periodKey(batchPeriod(todayIso()));

  return (
    <>
      <PageHeader
        title="Class work"
        description="Your weekly meetings and their class work grades."
        action={
          <div className="flex items-center gap-3">
            {back}
            <Button asChild size="lg">
              <Link href={`${BASE}/new?semester=${selected.id}`}><Plus aria-hidden="true" />Register weekly meeting</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">{periodLabel(selected)}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
            {total} weekly meeting{total === 1 ? "" : "s"} this semester.
          </p>
        </div>
        <SemesterSelect
          basePath={BASE}
          value={selected.id}
          choices={choices.map((c) => ({ id: c.id, label: periodLabel(c), current: periodKey(c) === nowKey }))}
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Weekly meeting</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-32 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="pl-4 font-medium">
                  <Link href={`${BASE}/${m.id}`} className="underline-offset-4 hover:underline">{m.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(m.heldOn)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${m.id}`} aria-label={`View ${m.name}`}><Eye aria-hidden="true" /></Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View</TooltipContent>
                    </Tooltip>
                    <EditLink href={`${BASE}/${m.id}/edit`} label={`Edit ${m.name}`} />
                    <ConfirmDeleteButton
                      action={deleteMeetingAction.bind(null, m.id)}
                      name={m.name}
                      noun="weekly meeting"
                      note="Its class work grades are removed too."
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {meetings.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  <EmptyAnimation />
                  {total === 0 ? "No weekly meetings registered for this semester yet." : "No weekly meetings on this page."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Pager page={page} pages={pages} href={pageHref} />
    </>
  );
}
