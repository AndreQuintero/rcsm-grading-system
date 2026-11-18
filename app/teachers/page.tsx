import Link from "next/link";
import { Suspense } from "react";
import { allSubjects } from "@/lib/subject";
import { listTeachers, PAGE_SIZE, parseIds } from "@/lib/teacher";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { SubjectMultiSelect } from "../SubjectMultiSelect";
import { deleteTeacher } from "./actions";

type SearchParams = { name?: string; email?: string; subject?: string | string[]; page?: string };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main><h1>Teachers</h1><p>Loading…</p></main>}>
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
      <div className="page-head">
        <h1>Teachers</h1>
        <Link className="btn btn-primary" href="/teachers/new">
          Register teacher
        </Link>
      </div>

      {/* keyed on the active filters so Clear (a client-side navigation) rebuilds the inputs */}
      <form key={pageHref(1)} method="get" className="filters" role="search" aria-label="Filter teachers">
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="filter-name" className="field-label">Full name</label>
            <input id="filter-name" name="name" defaultValue={name} placeholder="e.g. Rosenelyn" />
          </div>
          <div className="field">
            <label htmlFor="filter-email" className="field-label">Email</label>
            <input id="filter-email" name="email" defaultValue={email} placeholder="e.g. @gmail.com" />
          </div>
          <div className="field">
            <SubjectMultiSelect label="Subjects" name="subject" options={subjects} defaultValue={subjectIds} />
          </div>
        </div>
        <div className="filters-actions">
          {filtered && (
            <Link href="/teachers" className="btn btn-ghost">
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
        {total} teacher{total === 1 ? "" : "s"} found
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Full name</th>
              <th>Date of birth</th>
              <th>Email</th>
              <th>Subjects</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td>{t.full_name}</td>
                <td>{t.dob}</td>
                <td>{t.email}</td>
                <td>
                  <div className="tags">
                    {(t.subjects as string[]).map((s) => (
                      <span key={s} className="tag">{s}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="actions">
                    <Link className="btn btn-ghost" href={`/teachers/${t.id}/edit`}>
                      Edit
                    </Link>
                    <ConfirmDeleteButton action={deleteTeacher.bind(null, t.id)} name={t.full_name} noun="teacher" />
                  </div>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={5}>No teachers match these filters.</td>
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
