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
import { ADMIN_PAGE_SIZE, listAdmins } from "@/lib/admin";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { deleteAdmin } from "./actions";

type SearchParams = { name?: string; email?: string; page?: string };

const header = (
  <PageHeader
    title="Admins"
    description="The people who manage the system."
    action={
      <Button asChild size="lg">
        <Link href="/admins/new">
          <Plus aria-hidden="true" />
          Register admin
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
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const { admins, total } = await listAdmins({ name, email, page });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    if (email) q.set("email", email);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/admins?${qs}` : "/admins";
  };

  return (
    <main>
      {header}

      <Card className="mb-6 overflow-visible">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter admins" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-name">Full name</Label>
                <Input id="filter-name" name="name" defaultValue={name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-email">Email</Label>
                <Input id="filter-email" name="email" defaultValue={email} />
              </div>
            </div>
            <FilterActions clearHref="/admins" filtered={Boolean(name || email)} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} admin{total === 1 ? "" : "s"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Full name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Registered (UTC)</TableHead>
              <TableHead>Last modified (UTC)</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-4 font-medium">{a.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{a.email}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{a.dob}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{a.created}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{a.updated}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <EditLink href={`/admins/${a.id}/edit`} label={`Edit ${a.full_name}`} />
                    <ConfirmDeleteButton action={deleteAdmin.bind(null, a.id)} name={a.full_name} noun="admin" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {total === 0 ? "No admins match these filters." : "No admins on this page."}
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
