import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/dates";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listStudents, STUDENT_PAGE_SIZE } from "@/lib/student-queries";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { deleteStudent } from "./actions";

type SearchParams = { name?: string; status?: string; page?: string };

// "First Middle Last", skipping a missing middle name so there is never a double space.
const fullName = (s: Record<string, unknown>) =>
  [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");

const FILTERS = [
  { value: "", label: "Any" },
  { value: "full_time", label: "Full time" },
  { value: "audit", label: "Audit" },
];

const header = (
  <PageHeader
    title="Students"
    description="Everyone enrolled at the school, with their study type and enrollment date."
    action={
      <Button asChild size="lg">
        <Link href="/students/new">
          <Plus aria-hidden="true" />
          Register student
        </Link>
      </Button>
    }
  />
);

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<ListSkeleton filters={["Name", "Study type"]} columns={["Name", "Date of birth", "Status", "Enrollment date", "Actions"]} /></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const name = (sp.name ?? "").trim();
  const status = sp.status === "full_time" || sp.status === "audit" ? sp.status : "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { students, total } = await listStudents({ name, status, page });
  const pages = Math.max(1, Math.ceil(total / STUDENT_PAGE_SIZE));
  const filtered = Boolean(name || status);

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    if (status) q.set("status", status);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/students?${qs}` : "/students";
  };

  return (
    <main>
      {header}

      <Card className="mb-6">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter students" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-name">Name</Label>
                <Input id="filter-name" name="name" defaultValue={name} placeholder="First, middle or last name" />
              </div>
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-2 text-sm font-medium leading-none">Study type</legend>
                {/* native radios keep this a plain GET filter; styled as a segmented control */}
                <div className="inline-flex w-fit rounded-lg bg-muted p-1">
                  {FILTERS.map((f) => (
                    <label
                      key={f.value}
                      className="relative cursor-pointer rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
                    >
                      <input type="radio" name="status" value={f.value} defaultChecked={status === f.value} className="sr-only" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <FilterActions clearHref="/students" filtered={filtered} />
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
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrollment date</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-4 font-medium">{fullName(s)}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(s.dob)}</TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(s.enrolled)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <EditLink href={`/students/${s.id}/edit`} label={`Edit ${fullName(s)}`} />
                    <ConfirmDeleteButton action={deleteStudent.bind(null, s.id)} name={fullName(s)} noun="student" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No students match these filters.
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
