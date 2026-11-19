import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/dates";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allSubjects } from "@/lib/subject";
import { listTeachers, PAGE_SIZE, parseIds } from "@/lib/teacher";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { SubjectMultiSelect } from "../SubjectMultiSelect";
import { deleteTeacher } from "./actions";

type SearchParams = { name?: string; email?: string; subject?: string | string[]; page?: string };

const header = (
  <PageHeader
    title="Teachers"
    description="Everyone who teaches at the school, and the subjects they teach."
    action={
      <Button asChild size="lg">
        <Link href="/teachers/new">
          <Plus aria-hidden="true" />
          Register teacher
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
  const email = (sp.email ?? "").trim();
  const subjectIds = parseIds([sp.subject ?? []].flat());
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [{ teachers, total }, subjects] = await Promise.all([
    listTeachers({ name, email, subjectIds, page }),
    allSubjects(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(name || email || subjectIds.length);

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    if (email) q.set("email", email);
    subjectIds.forEach((id) => q.append("subject", String(id)));
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/teachers?${qs}` : "/teachers";
  };

  return (
    <main>
      {header}

      <Card className="mb-6 overflow-visible">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter teachers" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-name">Full name</Label>
                <Input id="filter-name" name="name" defaultValue={name} placeholder="e.g. Rosenelyn" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-email">Email</Label>
                <Input id="filter-email" name="email" defaultValue={email} placeholder="e.g. @gmail.com" />
              </div>
              <SubjectMultiSelect label="Subjects" name="subject" options={subjects} defaultValue={subjectIds} />
            </div>
            <FilterActions clearHref="/teachers" filtered={filtered} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} teacher{total === 1 ? "" : "s"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Full name</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="pl-4 font-medium">{t.full_name}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(t.dob)}</TableCell>
                <TableCell className="text-muted-foreground">{t.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(t.subjects as string[]).map((s) => (
                      <Badge key={s} variant="secondary" className="bg-accent font-medium text-accent-foreground">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <EditLink href={`/teachers/${t.id}/edit`} label={`Edit ${t.full_name}`} />
                    <ConfirmDeleteButton action={deleteTeacher.bind(null, t.id)} name={t.full_name} noun="teacher" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {teachers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No teachers match these filters.
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
