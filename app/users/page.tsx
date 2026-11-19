import { Eye } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/dates";
import { listUsers, USER_PAGE_SIZE } from "@/lib/user";
import { RoleTags, UserAvatar, UserStatusBadge } from "./UserBits";

type SearchParams = { username?: string; email?: string; page?: string };

// Accounts are created by the sign-in flow from the role tables, so there is nothing to register here.
const header = <PageHeader title="Users" description="Everyone with a sign-in account. Open a user to see their details or inactivate them." />;
const COLUMNS = ["Username", "Email", "Roles", "Status", "Created (UTC)", "Actions"];

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main>{header}<ListSkeleton filters={["Username", "Email"]} columns={COLUMNS} /></main>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams is request-time data, so it must sit under Suspense for cacheComponents prerendering.
async function Results({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const username = (sp.username ?? "").trim();
  const email = (sp.email ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const { users, total } = await listUsers({ username, email, page });
  const pages = Math.max(1, Math.ceil(total / USER_PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (username) q.set("username", username);
    if (email) q.set("email", email);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/users?${qs}` : "/users";
  };

  return (
    <main>
      {header}

      <Card className="mb-6 overflow-visible">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter users" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-username">Username</Label>
                <Input id="filter-username" name="username" defaultValue={username} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-email">Email</Label>
                <Input id="filter-email" name="email" defaultValue={email} />
              </div>
            </div>
            <FilterActions clearHref="/users" filtered={Boolean(username || email)} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} user{total === 1 ? "" : "s"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created (UTC)</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar id={u.id} hasPhoto={u.has_photo} className="size-8" />
                    <span className="font-medium">{u.username}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><RoleTags roles={u.roles} /></TableCell>
                <TableCell><UserStatusBadge status={u.status} /></TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDate(u.created)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/users/${u.id}`} aria-label={`View details of ${u.username}`}>
                            <Eye aria-hidden="true" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View details</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {total === 0 ? "No users match these filters." : "No users on this page."}
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
