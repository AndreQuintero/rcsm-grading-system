import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/BackLink";
import { ConfirmDeleteButton } from "@/app/ConfirmDeleteButton";
import { EditLink } from "@/app/EditLink";
import { EmptyAnimation } from "@/components/empty-animation";
import { FilterActions } from "@/components/filter-actions";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { RankingList } from "@/components/records/RankingList";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { periodLabel } from "@/lib/academic-semester";
import { assignmentMeetings, assignmentRanking, assignmentSubject, listAssignments, meetingLabel } from "@/lib/assignment";
import { SearchSelect } from "@/app/SearchSelect";
import { ASSIGNMENT_PAGE_SIZE } from "@/lib/assignment-shared";
import { formatDate, isRealDate } from "@/lib/dates";
import { requireTeacher, teaches } from "@/lib/grading";
import { deleteAssignmentAction } from "../../actions";
import { DateFilter } from "./DateFilter";

type Params = { semesterId: string; subjectId: string };
type SearchParams = { name?: string; date?: string; meeting?: string; page?: string };
const COLUMNS = ["Assignment", "Weekly meeting", "Date", "Students scored", "Average score", "Actions"];

export default function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main><ListSkeleton filters={["Weekly meeting", "Assignment name", "Date"]} columns={COLUMNS} /></main>}>
      <Results params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// params, searchParams and the session are request-time data, so they sit under Suspense (cacheComponents).
async function Results({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const [{ teacherId }, p, sp] = await Promise.all([requireTeacher(), params, searchParams]);
  const semesterId = Number(p.semesterId), subjectId = Number(p.subjectId);
  if (!Number.isInteger(semesterId) || !Number.isInteger(subjectId) || !(await teaches(semesterId, subjectId, teacherId))) notFound();
  const name = (sp.name ?? "").trim();
  const date = isRealDate(sp.date ?? "") ? sp.date! : "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const meetingId = /^\d+$/.test(sp.meeting ?? "") ? Number(sp.meeting) : null;
  const [head, { assignments, total }, ranking, meetings] = await Promise.all([
    assignmentSubject(semesterId, subjectId),
    listAssignments({ semesterId, subjectId, name, date, meetingId, page }),
    assignmentRanking(semesterId, subjectId),
    assignmentMeetings(teacherId, semesterId, subjectId),
  ]);
  const meeting = meetings.find((m) => m.id === meetingId);
  const students = ranking.students;
  if (!head) notFound();
  const base = `/teacher/assignments/${semesterId}/${subjectId}`;
  const pages = Math.max(1, Math.ceil(total / ASSIGNMENT_PAGE_SIZE));
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    if (meetingId !== null) q.set("meeting", String(meetingId));
    if (name) q.set("name", name);
    if (date) q.set("date", date);
    if (n > 1) q.set("page", String(n));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const filtered = Boolean(name || date || meetingId !== null);

  return (
    <main>
      <PageHeader
        title={head.subject}
        description={`${periodLabel(head.period)} assignments${meeting ? ` of ${meeting.name}` : ""}`}
        action={
          <div className="flex items-center gap-3">
            {/* reached from a weekly meeting: back goes to that meeting */}
            {meeting?.own ? (
              <BackLink href={`/teacher/gradings/class-work/${meeting.id}?subject=${subjectId}`} label={`Back to ${meeting.name}`} />
            ) : (
              <BackLink href={`/teacher/assignments?semester=${semesterId}`} label="Back to assignments" />
            )}
            <Button asChild size="lg">
              <Link href={`${base}/new${meeting?.own ? `?meeting=${meeting.id}` : ""}`}>
                <Plus aria-hidden="true" />
                Register assignment
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent>
          {/* keyed on the active filters so Clear (a client-side navigation) resets the inputs */}
          <form key={pageHref(1)} method="get" role="search" aria-label="Filter assignments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-meeting">Weekly meeting</Label>
                <SearchSelect
                  id="filter-meeting"
                  name="meeting"
                  options={meetings.map((m) => ({ value: String(m.id), label: meetingLabel(m, m.own) }))}
                  defaultValue={meetingId === null ? "" : String(meetingId)}
                  placeholder="All weekly meetings"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-name">Assignment name</Label>
                <Input id="filter-name" name="name" defaultValue={name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-date">Date</Label>
                <DateFilter id="filter-date" defaultValue={date} />
              </div>
            </div>
            <FilterActions clearHref={base} filtered={filtered} />
          </form>
        </CardContent>
      </Card>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} assignment{total === 1 ? "" : "s"} found
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Assignment</TableHead>
              <TableHead>Weekly meeting</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Students scored</TableHead>
              <TableHead>Average score</TableHead>
              <TableHead className="w-24 pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-4 font-medium">{a.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.meeting ? (
                    <>
                      {a.meeting.name}
                      {meetings.find((m) => m.id === a.meeting!.id)?.own ? null : <span className="block text-xs">{a.meeting.teacher}</span>}
                    </>
                  ) : "–"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(a.dueOn)}</TableCell>
                <TableCell className="tabular-nums">
                  {a.graded} <span className="text-muted-foreground">of {students.length}</span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {a.avg === null ? (
                    <span className="text-muted-foreground">Not scored yet</span>
                  ) : (
                    <>
                      <span className="font-medium">{a.avg}</span>
                      <span className="text-muted-foreground"> / {a.maxScore} ({Math.round((a.avg / a.maxScore) * 100)}%)</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <EditLink href={`${base}/${a.id}/edit`} label={`Edit ${a.name}`} />
                    <ConfirmDeleteButton
                      action={deleteAssignmentAction.bind(null, semesterId, subjectId, a.id)}
                      name={a.name}
                      noun="assignment"
                      note="Its students' scores are removed too."
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-10 text-center text-muted-foreground">
                  <EmptyAnimation />
                  {filtered ? "No assignments match these filters." : "No assignments registered for this subject yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Pager page={page} pages={pages} href={pageHref} />

      <section aria-labelledby="ranking" className="mt-8 rounded-[1.75rem] border border-border/70 bg-card p-6 sm:p-8">
        <div className="mb-4">
          <h2 id="ranking" className="font-heading text-xl font-bold">Assignment ranking</h2>
          <p className="text-sm text-muted-foreground">
            Points earned out of points possible in the assignments each student was scored in, across all{" "}
            {ranking.assignments} assignment{ranking.assignments === 1 ? "" : "s"} of {head.subject} this semester.
          </p>
        </div>
        {students.length ? (
          <RankingList
            rows={students.map((s) => ({
              id: s.id, name: s.name, place: s.place, photo: s.hasPhoto ? `/teacher/students/${s.id}/photo` : null,
              href: `/teacher/records/${s.id}`,
              detail: <>{s.batch}<span className="max-sm:hidden"> · {s.scored} of {ranking.assignments} assignment{ranking.assignments === 1 ? "" : "s"} scored</span></>,
              value: s.pct === null ? (
                <span className="text-sm text-muted-foreground">Not scored yet</span>
              ) : (
                <>
                  <span className="font-heading text-xl font-bold tabular-nums">{s.pct}%</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{s.earned} / {s.possible} pts</span>
                </>
              ),
            }))}
          />
        ) : (
          <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
            No students yet. They show up here once an admin assigns a batch to this subject.
          </p>
        )}
      </section>
    </main>
  );
}
