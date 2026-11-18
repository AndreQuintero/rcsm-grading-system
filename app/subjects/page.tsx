import Link from "next/link";
import { Suspense } from "react";
import { listSubjectPage, SUBJECT_PAGE_SIZE } from "@/lib/subject";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditLink } from "../EditLink";
import { deleteSubject } from "./actions";

type SearchParams = { name?: string; page?: string };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<main><h1>Subjects</h1><p>Loading…</p></main>}>
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
      <div className="page-head">
        <h1>Subjects</h1>
        <Link className="btn btn-primary" href="/subjects/new">
          Register subjects
        </Link>
      </div>

      {/* keyed on the active filter so Clear (a client-side navigation) resets the input */}
      <form key={name} method="get">
        <p>
          <label>
            Name
            <input name="name" defaultValue={name} />
          </label>
        </p>
        <button type="submit" className="btn btn-ghost">
          Filter
        </button>{" "}
        <Link href="/subjects">Clear</Link>
      </form>

      <p>
        {total} subject{total === 1 ? "" : "s"} found
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <div className="actions">
                    <EditLink href={`/subjects/${s.id}/edit`} label={`Edit ${s.name}`} />
                    <ConfirmDeleteButton action={deleteSubject.bind(null, s.id)} name={s.name} noun="subject" />
                  </div>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={2}>No subjects match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav>
        {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>} Page {page} of {pages}{" "}
        {page < pages && <Link href={pageHref(page + 1)}>Next</Link>}
      </nav>
    </main>
  );
}
