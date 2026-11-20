import { Eye } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/app/_dashboard/Avatar";
import { EmptyAnimation } from "@/components/empty-animation";
import { FilterActions } from "@/components/filter-actions";
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
import { requireRole } from "@/lib/auth/session";
import { STATUSES } from "@/lib/student";
import { listStudentRecords, STUDENT_RECORDS_PAGE_SIZE, studentRecordBatches } from "@/lib/student-records";

type SearchParams = { name?: string; email?: string; batch?: string; status?: string; page?: string };

const select = "h-9 w-full cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const COLUMNS = ["Student", "Email", "Batch", "Status", "Semesters", "Actions"];
const header = <PageHeader title="Student records" description="Every student's grades, semester by semester." />;

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<ListSkeleton filters={["Name", "Email", "Batch", "Status"]} columns={COLUMNS} /></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const name = (sp.name ?? "").trim();
  const email = (sp.email ?? "").trim();
  const batch = /^(\d+|none)$/.test(sp.batch ?? "") ? sp.batch! : "";
  const status = sp.status && sp.status in STATUSES ? sp.status : "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [{ students, total }, batches] = await Promise.all([listStudentRecords({ name, email, batch, status, page }), studentRecordBatches()]);
  const pages = Math.max(1, Math.ceil(total / STUDENT_RECORDS_PAGE_SIZE));
  const filtered = Boolean(name || email || batch || status);

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    if (email) q.set("email", email);
    if (batch) q.set("batch", batch);
    if (status) q.set("status", status);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/student-records?${qs}` : "/student-records";
  };

  return (
    <main>
      {header}
      <Card className="mb-6 overflow-visible">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter students" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-name">Name</Label>
                <Input id="filter-name" name="name" defaultValue={name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-email">Email</Label>
                <Input id="filter-email" name="email" defaultValue={email} placeholder="e.g. @gmail.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-batch">Batch</Label>
                <select id="filter-batch" name="batch" defaultValue={batch} className={select}>
                  <option value="">Any batch</option>
                  <option value="none">No batch</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-status">Status</Label>
                <select id="filter-status" name="status" defaultValue={status} className={select}>
                  <option value="">Any status</option>
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <FilterActions clearHref="/student-records" filtered={filtered} />
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
              <TableHead>Email</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Semesters</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={s.hasPhoto ? `/students/${s.id}/photo` : null} className="size-8" />
                    <span className="font-medium">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.batch ?? "No batch"}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{s.semesters}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/student-records/${s.id}`} aria-label={`View the record of ${s.name}`}>
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
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <EmptyAnimation />
                  {total === 0 ? (filtered ? "No students match these filters." : "No students registered yet.") : "No students on this page."}
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
