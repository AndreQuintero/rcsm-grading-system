import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACADEMIC_SEMESTER_PAGE_SIZE, listAcademicSemesters, periodLabel } from "@/lib/academic-semester";
import { batchLabel } from "@/lib/batch";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { deleteAcademicSemester } from "./actions";

type SearchParams = { year?: string; page?: string };
type BatchRef = { number: number; year: number; semester: number };

const asInt = (v?: string) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const COLUMNS = ["Semester", "Batches", "Teachers", "Subjects", "Students", "Actions"];

const header = (
  <PageHeader
    title="Academic semesters"
    description="Each semester's batches, and the teachers with the subjects they teach in it."
    action={
      <Button asChild size="lg">
        <Link href="/academic-semesters/new">
          <Plus aria-hidden="true" />
          Register academic semester
        </Link>
      </Button>
    }
  />
);

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<ListSkeleton filters={["Year"]} columns={COLUMNS} /></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const year = asInt(sp.year);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { semesters, total } = await listAcademicSemesters({ year, page });
  const pages = Math.max(1, Math.ceil(total / ACADEMIC_SEMESTER_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (year !== null) q.set("year", String(year));
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/academic-semesters?${qs}` : "/academic-semesters";
  };

  return (
    <main>
      {header}

      <Card className="mb-6">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter academic semesters" className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="filter-year">Year</Label>
              <Input id="filter-year" name="year" type="number" min={2000} max={2100} defaultValue={year ?? ""} placeholder="e.g. 2026" />
            </div>
            <FilterActions clearHref="/academic-semesters" filtered={year !== null} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {plural(total, "academic semester")} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Semester</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>Teachers</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead>Students</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semesters.map((s) => {
              const label = periodLabel(s as { year: number; semester: number });
              return (
                <TableRow key={s.id}>
                  <TableCell className="pl-4 font-medium">{label}</TableCell>
                  <TableCell>
                    {(s.batches as BatchRef[]).length ? (
                      <div className="flex flex-wrap gap-1">
                        {(s.batches as BatchRef[]).map((b) => (
                          <Badge key={`${b.year}-${b.semester}-${b.number}`} variant="secondary" className="bg-accent font-medium text-accent-foreground">
                            {batchLabel(b)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None yet</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{s.teachers}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{s.subjects}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{s.students}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <EditLink href={`/academic-semesters/${s.id}/edit`} label={`Edit the academic semester ${label}`} />
                      <ConfirmDeleteButton
                        action={deleteAcademicSemester.bind(null, s.id)}
                        name={`the academic semester ${label}`}
                        noun="academic semester"
                        note="Its batches, teachers and subjects are kept."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {semesters.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {total === 0 ? (year !== null ? "No academic semesters match this year." : "No academic semesters registered yet.") : "No academic semesters on this page."}
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
