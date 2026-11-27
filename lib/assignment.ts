import { sql } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { batchLabel } from "@/lib/batch";
import { rankStudents } from "@/lib/dashboard";
import { gradedStudents } from "@/lib/grading";
import { ASSIGNMENT_PAGE_SIZE, type AssignmentInput } from "@/lib/assignment-shared";

// Assignments are keyed by semester + subject, so every teacher of that subject in that semester shares them (as
// with grades). Callers check teaches(semester, subject, teacher) first.

// The subject's name and the semester's period for page headers; null when either doesn't exist.
export async function assignmentSubject(semesterId: number, subjectId: number) {
  const [r] = await sql`SELECT a.year, a.semester, s.name FROM academic_semesters a, subjects s WHERE a.id = ${semesterId} AND s.id = ${subjectId}`;
  return r ? { subject: r.name as string, period: { year: r.year as number, semester: r.semester as number } } : null;
}

// How many assignments each subject has in a semester (subjects with none are missing from the map).
export async function assignmentCounts(semesterId: number): Promise<Map<number, number>> {
  const rows = await sql`SELECT subject_id, count(*)::int AS n FROM assignments WHERE academic_semester_id = ${semesterId} GROUP BY subject_id`;
  return new Map(rows.map((r) => [r.subject_id as number, r.n as number]));
}

export type MeetingRef = { id: number; name: string; heldOn: string; teacher: string };
export type AssignmentRow = { id: number; name: string; dueOn: string; maxScore: number; graded: number; avg: number | null; meeting: MeetingRef | null };

const meetingRef = (r: Record<string, unknown>): MeetingRef | null =>
  r.meeting_id ? { id: r.meeting_id as number, name: r.meeting_name as string, heldOn: r.meeting_on as string, teacher: r.meeting_teacher as string } : null;

// One page of a subject's assignments, newest date first, with their weekly meeting (and its teacher), how many
// students are scored and their average. meetingId keeps one meeting's assignments.
export async function listAssignments({ semesterId, subjectId, name = "", date = "", meetingId = null, page = 1 }: {
  semesterId: number; subjectId: number; name?: string; date?: string; meetingId?: number | null; page?: number;
}) {
  const rows = await sql.query(
    `SELECT a.id, a.name, a.due_on::text AS due_on, a.max_score, a.meeting_id, m.name AS meeting_name,
       m.held_on::text AS meeting_on, t.full_name AS meeting_teacher,
       count(sc.score)::int AS graded, round(avg(sc.score), 1)::float AS avg, count(*) OVER() AS total
     FROM assignments a LEFT JOIN assignment_scores sc ON sc.assignment_id = a.id
     LEFT JOIN class_meetings m ON m.id = a.meeting_id LEFT JOIN teachers t ON t.id = m.teacher_id
     WHERE a.academic_semester_id = $1 AND a.subject_id = $2
       AND ($3 = '' OR a.name ILIKE '%' || $3 || '%') AND ($4 = '' OR a.due_on = $4::date)
       AND ($6::int IS NULL OR a.meeting_id = $6)
     GROUP BY a.id, m.id, t.id
     ORDER BY a.due_on DESC, a.name, a.id
     LIMIT ${ASSIGNMENT_PAGE_SIZE} OFFSET $5`,
    [semesterId, subjectId, name, date, (page - 1) * ASSIGNMENT_PAGE_SIZE, meetingId],
  );
  return {
    assignments: rows.map((r): AssignmentRow => ({
      id: r.id as number, name: r.name as string, dueOn: r.due_on as string, maxScore: r.max_score as number,
      graded: r.graded as number, avg: (r.avg as number | null) ?? null, meeting: meetingRef(r),
    })),
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

export type AssignmentStudent = { id: number; name: string; hasPhoto: boolean; batch: string };

// The students an assignment can score: those the subject grades (not inactive, in a batch bound to the subject that
// is still in the semester), plus how many batches are bound.
export async function assignmentStudents(semesterId: number, subjectId: number) {
  const [students, [b]] = await Promise.all([
    sql.query(
      `SELECT g.id, concat_ws(' ', g.first_name, g.middle_name, g.last_name) AS name, g.photo IS NOT NULL AS has_photo,
         bt.number, bt.year, bt.semester
       FROM (${gradedStudents()}) g JOIN batches bt ON bt.id = g.bound_batch
       ORDER BY g.last_name, g.first_name, g.id`,
      [semesterId, subjectId],
    ),
    sql`SELECT count(*)::int AS n FROM subject_batches sb JOIN academic_semester_batches ab
          ON ab.academic_semester_id = sb.academic_semester_id AND ab.batch_id = sb.batch_id
        WHERE sb.academic_semester_id = ${semesterId} AND sb.subject_id = ${subjectId}`,
  ]);
  return {
    batches: b.n as number,
    students: students.map((s): AssignmentStudent => ({
      id: s.id as number, name: s.name as string, hasPhoto: s.has_photo as boolean,
      batch: batchLabel(s as { number: number; year: number; semester: number }),
    })),
  };
}

// One assignment of this semester + subject with its scores; null when it isn't one of theirs.
export async function getAssignment(semesterId: number, subjectId: number, id: number) {
  const [a] = await sql`
    SELECT a.id, a.name, a.due_on::text AS due_on, a.max_score, a.meeting_id, m.name AS meeting_name,
      m.held_on::text AS meeting_on, t.full_name AS meeting_teacher, m.teacher_id AS meeting_teacher_id,
      coalesce((SELECT json_object_agg(sc.student_id, sc.score) FROM assignment_scores sc WHERE sc.assignment_id = a.id AND sc.score IS NOT NULL), '{}') AS scores,
      coalesce((SELECT json_object_agg(sc.student_id, sc.comment) FROM assignment_scores sc WHERE sc.assignment_id = a.id AND sc.comment IS NOT NULL), '{}') AS comments
    FROM assignments a LEFT JOIN class_meetings m ON m.id = a.meeting_id LEFT JOIN teachers t ON t.id = m.teacher_id
    WHERE a.id = ${id} AND a.academic_semester_id = ${semesterId} AND a.subject_id = ${subjectId}`;
  if (!a) return null;
  return {
    id: a.id as number, name: a.name as string, dueOn: a.due_on as string, maxScore: a.max_score as number,
    scores: a.scores as Record<string, number>, comments: a.comments as Record<string, string>, meeting: meetingRef(a), meetingTeacherId: (a.meeting_teacher_id as number | null) ?? null,
  };
}

// Creates (id = null) or updates an assignment and its scores + comments in one go. Only students in `allowed` (the
// ones the subject grades now) are written: a student with a score or a comment gets both stored, one with neither has
// their row removed; rows of anyone else are kept. Returns the id, or null when the assignment to update isn't one of
// this semester + subject.
export async function saveAssignment(
  semesterId: number, subjectId: number, id: number | null, userId: number | null, input: AssignmentInput, allowed: number[],
): Promise<number | null> {
  const ids: number[] = [], scores: (number | null)[] = [], comments: (string | null)[] = [], blanks: number[] = [];
  for (const sid of allowed) {
    const score = input.scores.get(sid) ?? null, comment = input.comments.get(sid) ?? null;
    if (score === null && comment === null) blanks.push(sid);
    else { ids.push(sid); scores.push(score); comments.push(comment); }
  }
  if (id === null) {
    const [r] = await sql.query(
      `WITH a AS (
         INSERT INTO assignments (academic_semester_id, subject_id, name, due_on, max_score, updated_by, meeting_id)
         VALUES ($1, $2, $3, $4, $5, $6, $10) RETURNING id
       ), s AS (
         INSERT INTO assignment_scores (assignment_id, student_id, score, comment)
         SELECT a.id, x.student_id, x.score, x.comment FROM a, unnest($7::int[], $8::int[], $9::text[]) AS x(student_id, score, comment)
       )
       SELECT id FROM a`,
      [semesterId, subjectId, input.name, input.dueOn, input.maxScore, userId, ids, scores, comments, input.meetingId],
    );
    return r.id as number;
  }
  const [updated] = await sql.transaction([
    sql`UPDATE assignments SET name = ${input.name}, due_on = ${input.dueOn}, max_score = ${input.maxScore}, meeting_id = ${input.meetingId},
          updated_by = ${userId}, updated_at = now()
        WHERE id = ${id} AND academic_semester_id = ${semesterId} AND subject_id = ${subjectId} RETURNING id`,
    sql`DELETE FROM assignment_scores sc USING assignments a
        WHERE sc.assignment_id = a.id AND a.id = ${id} AND a.academic_semester_id = ${semesterId} AND a.subject_id = ${subjectId}
          AND sc.student_id = ANY(${blanks}::int[])`,
    sql`INSERT INTO assignment_scores (assignment_id, student_id, score, comment)
        SELECT a.id, x.student_id, x.score, x.comment FROM assignments a, unnest(${ids}::int[], ${scores}::int[], ${comments}::text[]) AS x(student_id, score, comment)
        WHERE a.id = ${id} AND a.academic_semester_id = ${semesterId} AND a.subject_id = ${subjectId}
        ON CONFLICT (assignment_id, student_id) DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment`,
  ]);
  return updated.length ? id : null;
}

// Scores already saved above a new maximum (only for students still listed), so lowering the maximum can't leave a
// score out of range.
export async function scoresAbove(id: number, maxScore: number, keep: number[]): Promise<number> {
  const [r] = await sql`SELECT count(*)::int AS n FROM assignment_scores
    WHERE assignment_id = ${id} AND score > ${maxScore} AND NOT (student_id = ANY(${keep}::int[]))`;
  return r.n as number;
}

// The dates that have assignments of this semester + subject (newest first), for the date filter.
export async function assignmentDates(semesterId: number, subjectId: number): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT due_on::text AS d FROM assignments
    WHERE academic_semester_id = ${semesterId} AND subject_id = ${subjectId} ORDER BY d DESC`;
  return rows.map((r) => r.d as string);
}

// The weekly meetings an assignment form or filter can offer: the teacher's own meetings in the semester, plus (for
// the filter) meetings of other teachers that already hold this subject's assignments. Newest first.
export async function assignmentMeetings(teacherId: number, semesterId: number, subjectId: number) {
  const rows = await sql`
    SELECT m.id, m.name, m.held_on::text AS held_on, t.full_name AS teacher, m.teacher_id = ${teacherId} AS own
    FROM class_meetings m JOIN teachers t ON t.id = m.teacher_id
    WHERE m.academic_semester_id = ${semesterId}
      AND (m.teacher_id = ${teacherId} OR EXISTS (SELECT 1 FROM assignments a WHERE a.meeting_id = m.id AND a.subject_id = ${subjectId}))
    ORDER BY m.held_on DESC, m.id DESC`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, heldOn: r.held_on as string, teacher: r.teacher as string, own: r.own as boolean }));
}

// "Week #3 · Aug 10, 2090", plus the teacher's name when it isn't the viewer's own meeting.
export const meetingLabel = (m: { name: string; heldOn: string; teacher: string }, own: boolean) =>
  `${m.name} · ${formatDate(m.heldOn)}${own ? "" : ` · ${m.teacher}`}`;

// An assignment may be put in one of the teacher's own meetings of the semester; an edit may also keep the meeting it
// already has (another teacher's, since assignments are shared by the subject's teachers).
export async function meetingAllowed(teacherId: number, semesterId: number, meetingId: number, keep: number | null = null): Promise<boolean> {
  if (keep !== null && meetingId === keep) return true;
  const [r] = await sql`SELECT 1 FROM class_meetings WHERE id = ${meetingId} AND teacher_id = ${teacherId} AND academic_semester_id = ${semesterId}`;
  return Boolean(r);
}

export async function deleteAssignment(semesterId: number, subjectId: number, id: number): Promise<void> {
  await sql`DELETE FROM assignments WHERE id = ${id} AND academic_semester_id = ${semesterId} AND subject_id = ${subjectId}`;
}

export type AssignmentRank = AssignmentStudent & { place: number | null; pct: number | null; earned: number; possible: number; scored: number };

// Every student the subject grades, ranked by points earned ÷ points possible over the assignments they were scored
// in (an unscored assignment doesn't count), as a % rounded to one decimal so equal shown values share a place.
// Students with no score yet come last, unranked. Also returns how many assignments the subject has.
export async function assignmentRanking(semesterId: number, subjectId: number) {
  const [rows, [c]] = await Promise.all([
    sql.query(
      `SELECT g.id, concat_ws(' ', g.first_name, g.middle_name, g.last_name) AS name, g.photo IS NOT NULL AS has_photo,
         bt.number, bt.year, bt.semester,
         coalesce(sum(sc.score), 0)::int AS earned, coalesce(sum(a.max_score) FILTER (WHERE sc.score IS NOT NULL), 0)::int AS possible,
         count(sc.score)::int AS scored
       FROM (${gradedStudents()}) g
       JOIN batches bt ON bt.id = g.bound_batch
       LEFT JOIN assignments a ON a.academic_semester_id = $1 AND a.subject_id = $2
       LEFT JOIN assignment_scores sc ON sc.assignment_id = a.id AND sc.student_id = g.id
       GROUP BY g.id, g.first_name, g.middle_name, g.last_name, g.photo, bt.id`,
      [semesterId, subjectId],
    ),
    sql`SELECT count(*)::int AS n FROM assignments WHERE academic_semester_id = ${semesterId} AND subject_id = ${subjectId}`,
  ]);
  const all = rows.map((r) => {
    const possible = r.possible as number, earned = r.earned as number;
    return {
      id: r.id as number, name: r.name as string, hasPhoto: r.has_photo as boolean,
      batch: batchLabel(r as { number: number; year: number; semester: number }),
      earned, possible, scored: r.scored as number,
      pct: possible ? Math.round((earned / possible) * 1000) / 10 : null,
    };
  });
  const ranked = rankStudents(all.filter((s) => s.pct !== null).map((s) => ({ ...s, score: s.pct! })), Infinity);
  const unscored = all.filter((s) => s.pct === null).sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ ...s, place: null }));
  return { assignments: c.n as number, students: [...ranked, ...unscored] as AssignmentRank[] };
}
