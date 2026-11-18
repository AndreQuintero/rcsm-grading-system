import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSubjectPage, SUBJECT_PAGE_SIZE } from "@/lib/subject";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { deleteSubject } from "./actions";

type SearchParams = { name?: string; page?: string };

const header = (
  <PageHeader
    title="Subjects"
    description="The subjects taught at the school. Teachers choose from this list."
    action={
      <Button asChild size="lg">
        <Link href="/subjects/new">
          <Plus aria-hidden="true" />
          Register subjects
        </Link>
      </Button>
    }
  />
);

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<p className="text-sm text-muted-foreground">Loading…</p></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const name = (sp.name ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { subjects, total } = await listSubjectPage({ name, page });
  const pages = Math.max(1, Math.ceil(total / SUBJECT_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/subjects?${qs}` : "/subjects";
  };

  return (
    <main>
      {header}

      <Card className="mb-6">
        <CardContent>
          {/* keyed on the active filter so Clear (a client-side navigation) resets the input */}
          <form key={name} method="get" role="search" aria-label="Filter subjects" className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="filter-name">Name</Label>
              <Input id="filter-name" name="name" defaultValue={name} placeholder="e.g. Worship" />
            </div>
            <FilterActions clearHref="/subjects" filtered={Boolean(name)} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} subject{total === 1 ? "" : "s"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-4 font-medium">{s.name}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <EditLink href={`/subjects/${s.id}/edit`} label={`Edit ${s.name}`} />
                    <ConfirmDeleteButton action={deleteSubject.bind(null, s.id)} name={s.name} noun="subject" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {subjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  No subjects match this filter.
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
