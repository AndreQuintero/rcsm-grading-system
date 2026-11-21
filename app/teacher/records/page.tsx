import { ClipboardCheck, Eye } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { EmptyAnimation } from "@/components/empty-animation";
import { FilterActions } from "@/components/filter-actions";
import { LottiePlayer } from "@/components/lottie-player";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ListSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { periodLabel } from "@/lib/academic-semester";
import { RECORDS_PAGE_SIZE, requireTeacher, teacherStudentFilters, teacherStudents } from "@/lib/grading";

type SearchParams = { name?: string; batch?: string; semester?: string; page?: string };

const asId = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
const select = "h-9 w-full cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const COLUMNS = ["Student", "Batch", "Status", "Subjects graded", "Actions"];
const header = <PageHeader title="Score records" description="The students you teach, across every semester, and their grades in your subjects." />;

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<ListSkeleton filters={["Name", "Batch", "Semester"]} columns={COLUMNS} /></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// The session and searchParams are request-time data, so they sit under Suspense (cacheComponents).
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ teacherId }, sp] = await Promise.all([requireTeacher(), searchParams]);
  const name = (sp.name ?? "").trim();
  const batchId = asId(sp.batch);
  const semesterId = asId(sp.semester);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filtered = Boolean(name || batchId || semesterId);
  const [{ students, total }, options] = await Promise.all([
    teacherStudents(teacherId, { name, batchId, semesterId, page }),
    teacherStudentFilters(teacherId),
  ]);
  const pages = Math.max(1, Math.ceil(total / RECORDS_PAGE_SIZE));

  if (!total && !filtered)
    return (
      <main>
        {header}
        <section aria-labelledby="no-students" className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-10 text-center">
          <LottiePlayer name="get-things-done" className="aspect-[1100/1000] w-56" />
          <h2 id="no-students" className="mt-2 font-heading text-2xl font-bold">No students yet</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Your students appear here once you add a batch to one of your subjects in Gradings.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/teacher/gradings">
              <ClipboardCheck aria-hidden="true" />
              Go to Gradings
            </Link>
          </Button>
        </section>
      </main>
    );

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    if (batchId) q.set("batch", String(batchId));
    if (semesterId) q.set("semester", String(semesterId));
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/teacher/records?${qs}` : "/teacher/records";
  };

  return (
    <main>
      {header}
      <Card className="mb-6 overflow-visible">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter students" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-name">Name</Label>
                <Input id="filter-name" name="name" defaultValue={name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-batch">Batch</Label>
                <select id="filter-batch" name="batch" defaultValue={batchId ?? ""} className={select}>
                  <option value="">Any batch</option>
                  {options.batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-semester">Semester</Label>
                <select id="filter-semester" name="semester" defaultValue={semesterId ?? ""} className={select}>
                  <option value="">Any semester</option>
                  {options.semesters.map((s) => <option key={s.id} value={s.id}>{periodLabel(s)}</option>)}
                </select>
              </div>
            </div>
            <FilterActions clearHref="/teacher/records" filtered={filtered} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} student{total === 1 ? "" : "s"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Student</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subjects graded</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={s.hasPhoto ? `/teacher/students/${s.id}/photo` : null} className="size-8" />
                    <span className="font-medium">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.batch ?? "No batch"}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{s.graded}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/teacher/records/${s.id}`} aria-label={`View the score record of ${s.name}`}>
                            <Eye aria-hidden="true" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View record</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <EmptyAnimation />
                  {total === 0 ? "No students match these filters." : "No students on this page."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Pager page={page} pages={pages} href={pageHref} />
    </main>
  );
}
