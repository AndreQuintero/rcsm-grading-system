import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyAnimation } from "@/components/empty-animation";
import { ListSkeleton } from "@/components/skeletons";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BATCH_PAGE_SIZE, batchLabel, listBatches, ordinal } from "@/lib/batch";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { deleteBatch } from "./actions";

type SearchParams = { student?: string; number?: string; year?: string; page?: string };

const asInt = (v?: string) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

const header = (
  <PageHeader
    title="Batches"
    description="Each intake of students, by batch number, year and semester."
    action={
      <Button asChild size="lg">
        <Link href="/batches/new">
          <Plus aria-hidden="true" />
          Register batch
        </Link>
      </Button>
    }
  />
);

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<ListSkeleton filters={["Batch number", "Year"]} columns={["Batch", "Year", "Semester", "Students", "Actions"]} /></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const number = asInt(sp.number);
  const year = asInt(sp.year);
  const student = (sp.student ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { batches, total } = await listBatches({ number, year, student, page });
  const pages = Math.max(1, Math.ceil(total / BATCH_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (student) q.set("student", student);
    if (number !== null) q.set("number", String(number));
    if (year !== null) q.set("year", String(year));
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/batches?${qs}` : "/batches";
  };

  return (
    <main>
      {header}

      <Card className="mb-6">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter batches" className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-student">Student name</Label>
                <Input id="filter-student" name="student" maxLength={100} defaultValue={student} placeholder="e.g. Maria" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-number">Batch number</Label>
                <Input id="filter-number" name="number" type="number" min={1} defaultValue={number ?? ""} placeholder="e.g. 1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-year">Year</Label>
                <Input id="filter-year" name="year" type="number" min={2000} max={2100} defaultValue={year ?? ""} placeholder="e.g. 2026" />
              </div>
            </div>
            <FilterActions clearHref="/batches" filtered={student !== "" || number !== null || year !== null} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} batch{total === 1 ? "" : "es"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Batch</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Students</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => {
              const label = batchLabel(b as { number: number; year: number; semester: number });
              return (
                <TableRow key={b.id}>
                  <TableCell className="pl-4 font-medium">{ordinal(b.number)} batch</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{b.year}</TableCell>
                  <TableCell className="text-muted-foreground">{ordinal(b.semester)} semester</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-accent font-medium text-accent-foreground tabular-nums">
                      {b.students} student{b.students === 1 ? "" : "s"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <EditLink href={`/batches/${b.id}/edit`} label={`Edit the ${label}`} />
                      <ConfirmDeleteButton
                        action={deleteBatch.bind(null, b.id)}
                        name={`the ${label}`}
                        noun="batch"
                        note="Its students are kept and can join another batch."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {batches.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <EmptyAnimation />
                  No batches match these filters.
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
