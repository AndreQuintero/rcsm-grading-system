import Link from "next/link";
import { Suspense } from "react";
import { STATUSES, type Status } from "@/lib/student";
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

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main><h1>Students</h1><p>Loading…</p></main>}>
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
      <div className="page-head">
        <h1>Students</h1>
        <Link className="btn btn-primary" href="/students/new">
          Register student
        </Link>
      </div>

      {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
      <form key={pageHref(1)} method="get" className="filters" role="search" aria-label="Filter students">
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="filter-name" className="field-label">Name</label>
            <input id="filter-name" name="name" defaultValue={name} placeholder="First, middle or last name" />
          </div>
          <fieldset className="field segmented-field">
            <legend className="field-label">Study type</legend>
            <div className="segmented">
              {FILTERS.map((f) => (
                <label key={f.value}>
                  <input type="radio" name="status" value={f.value} defaultChecked={status === f.value} />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="filters-actions">
          {filtered && (
            <Link href="/students" className="btn btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Clear filters
            </Link>
          )}
          <button type="submit" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Filter
          </button>
        </div>
      </form>

      <p className="result-count">
        {total} student{total === 1 ? "" : "s"} found
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Date of birth</th>
              <th>Status</th>
              <th>Enrollment date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{fullName(s)}</td>
                <td>{s.dob}</td>
                <td>
                  <span className={`badge badge-${s.status}`}>{STATUSES[s.status as Status]}</span>
                </td>
                <td>{s.enrolled ?? "—"}</td>
                <td>
                  <div className="actions">
                    <EditLink href={`/students/${s.id}/edit`} label={`Edit ${fullName(s)}`} />
                    <ConfirmDeleteButton
                      action={deleteStudent.bind(null, s.id)}
                      name={fullName(s)}
                      noun="student"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5}>No students match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pagination">
        {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>} Page {page} of {pages}{" "}
        {page < pages && <Link href={pageHref(page + 1)}>Next</Link>}
      </nav>
    </main>
  );
}
