import Link from "next/link";
import { Suspense } from "react";
import { listSubjects, listTeachers, PAGE_SIZE } from "@/lib/teacher";

type SearchParams = { name?: string; subject?: string | string[]; page?: string };

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
  const subjects = [sp.subject ?? []].flat().filter(Boolean);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [{ teachers, total }, allSubjects] = await Promise.all([
    listTeachers({ name, subjects, page }),
    listSubjects(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (name) q.set("name", name);
    subjects.forEach((s) => q.append("subject", s));
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/teachers?${qs}` : "/teachers";
  };

  return (
    <main>
      <h1>Teachers</h1>
      <form method="get">
        <p>
          <label>
            Name
            <input name="name" defaultValue={name} />
          </label>
        </p>
        <fieldset>
          <legend>Subjects (matches any selected)</legend>
          {allSubjects.map((s) => (
            <label key={s} style={{ display: "block" }}>
              <input type="checkbox" name="subject" value={s} defaultChecked={subjects.includes(s)} /> {s}
            </label>
          ))}
          {allSubjects.length === 0 && <p>No subjects yet.</p>}
        </fieldset>
        <button type="submit">Filter</button> <Link href="/teachers">Clear</Link>
      </form>

      <p>
        {total} teacher{total === 1 ? "" : "s"} found
      </p>
      <table>
        <thead>
          <tr>
            <th>Full name</th>
            <th>Date of birth</th>
            <th>Email</th>
            <th>Subjects</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id}>
              <td>{t.full_name}</td>
              <td>{t.dob}</td>
              <td>{t.email}</td>
              <td>{(t.subjects as string[]).join(", ")}</td>
            </tr>
          ))}
          {teachers.length === 0 && (
            <tr>
              <td colSpan={4}>No teachers match these filters.</td>
            </tr>
          )}
        </tbody>
      </table>

      <nav>
        {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>} Page {page} of {pages}{" "}
        {page < pages && <Link href={pageHref(page + 1)}>Next</Link>}
      </nav>
    </main>
  );
}
