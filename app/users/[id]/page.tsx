import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getUser } from "@/lib/user";
import { RoleTags, UserAvatar, UserStatusBadge } from "../UserBits";
import { ActiveToggle } from "./ActiveToggle";

const header = <PageHeader title="User details" description="Sign-in account, roles and status." action={<BackLink href="/users" label="Back to users" />} />;

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto max-w-3xl">
      {header}
      <Suspense fallback={<FormSkeleton fields={["Email", "Roles", "Member since", "Last sign-in"]} photo />}>
        <Details params={params} />
      </Suspense>
    </main>
  );
}

// params and the session are request-time data, so they sit under Suspense for cacheComponents prerendering.
async function Details({ params }: { params: Promise<{ id: string }> }) {
  const n = Number((await params).id);
  const [u, s] = await Promise.all([Number.isInteger(n) && n > 0 ? getUser(n) : null, getSession()]);
  if (!u) notFound();
  const when = (v: string | null, none: string) => (v ? `${formatDate(v)} UTC` : none);
  const rows: [string, React.ReactNode][] = [
    ["Email", u.email],
    ["Roles", <RoleTags key="r" roles={u.roles} />],
    ["Member since", when(u.created, "—")],
    ["Password set", when(u.password_set, "Not yet (first sign-in pending)")],
    ["Last sign-in", when(u.last_login, "Never")],
    ...(u.locked_until ? [["Locked until", when(u.locked_until, "")] as [string, React.ReactNode]] : []),
    ...(u.disabled ? [["Inactive since", when(u.disabled, "")] as [string, React.ReactNode]] : []),
  ];
  const self = s?.userId === u.id;

  return (
    <Card>
      <CardContent className="flex flex-col gap-8">
        <div className="flex items-center gap-5">
          <UserAvatar id={u.id} hasPhoto={u.has_photo} className="size-20 ring-2" />
          <div className="min-w-0 space-y-1.5">
            <h2 className="truncate font-heading text-2xl font-bold">{u.username}</h2>
            <UserStatusBadge status={u.status} />
          </div>
        </div>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="justify-end border-t">
        {self ? (
          <p className="text-sm text-muted-foreground">This is your account, so you can&apos;t inactivate it.</p>
        ) : (
          <ActiveToggle id={u.id} username={u.username} inactive={u.status === "inactive"} />
        )}
      </CardFooter>
    </Card>
  );
}
