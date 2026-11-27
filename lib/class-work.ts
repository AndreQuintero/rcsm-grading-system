import { sql } from "@/lib/db";
import { batchLabel } from "@/lib/batch";
import { gradedStudents } from "@/lib/grading";
import { CLASS_WORK_PAGE_SIZE, type Attendance, type Marks, type MeetingInput, type Participation } from "@/lib/class-work-shared";

// Class work: weekly meetings belong to one teacher (every query is filtered by teacher_id), in one academic semester.

export type Meeting = { id: number; name: string; heldOn: string; semesterId: number; period: { year: number; semester: number } };

const toMeeting = (r: Record<string, unknown>): Meeting => ({
  id: r.id as number, name: r.name as string, heldOn: r.held_on as string, semesterId: r.academic_semester_id as number,
  period: { year: r.year as number, semester: r.semester as number },
});

// Newest date first, 10 per page.
export async function listMeetings(teacherId: number, semesterId: number, page = 1) {
  const rows = await sql`
    SELECT id, name, held_on::text AS held_on, count(*) OVER() AS total FROM class_meetings
    WHERE teacher_id = ${teacherId} AND academic_semester_id = ${semesterId}
    ORDER BY held_on DESC, id DESC
    LIMIT ${CLASS_WORK_PAGE_SIZE} OFFSET ${(page - 1) * CLASS_WORK_PAGE_SIZE}`;
  return {
    meetings: rows.map((r) => ({ id: r.id as number, name: r.name as string, heldOn: r.held_on as string })),
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

export async function getMeeting(teacherId: number, id: number): Promise<Meeting | null> {
  const [r] = await sql`
    SELECT m.id, m.name, m.held_on::text AS held_on, m.academic_semester_id, a.year, a.semester
    FROM class_meetings m JOIN academic_semesters a ON a.id = m.academic_semester_id
    WHERE m.id = ${id} AND m.teacher_id = ${teacherId}`;
  return r ? toMeeting(r) : null;
}

// Only in a semester where the teacher teaches. Returns the new id, or null.
export async function insertMeeting(teacherId: number, semesterId: number, m: MeetingInput): Promise<number | null> {
  const [r] = await sql`
    INSERT INTO class_meetings (teacher_id, academic_semester_id, name, held_on)
    SELECT ${teacherId}, ${semesterId}, ${m.name}, ${m.heldOn}
    WHERE EXISTS (SELECT 1 FROM academic_semester_teacher_subjects WHERE academic_semester_id = ${semesterId} AND teacher_id = ${teacherId})
    RETURNING id`;
  return r ? (r.id as number) : null;
}

export async function updateMeeting(teacherId: number, id: number, m: MeetingInput): Promise<boolean> {
  return (await sql`UPDATE class_meetings SET name = ${m.name}, held_on = ${m.heldOn}, updated_at = now()
    WHERE id = ${id} AND teacher_id = ${teacherId} RETURNING id`).length > 0;
}

// Its marks are removed too (cascade).
export async function deleteMeeting(teacherId: number, id: number): Promise<boolean> {
  return (await sql`DELETE FROM class_meetings WHERE id = ${id} AND teacher_id = ${teacherId} RETURNING id`).length > 0;
}

export type MeetingStudent = { id: number; name: string; status: string; hasPhoto: boolean; batch: string; marks: Marks };

const toStudent = (s: Record<string, unknown>): MeetingStudent => ({
  id: s.id as number, name: s.name as string, status: s.status as string, hasPhoto: s.has_photo as boolean,
  batch: batchLabel(s as { number: number; year: number; semester: number }),
  marks: {
    attendance: (s.attendance ?? null) as Marks["attendance"], assignments: (s.assignments ?? null) as number | null,
    participation: (s.participation ?? null) as number | null, participationComment: (s.participation_comment ?? null) as string | null,
  },
});

// How many assignments this meeting has for the subject.
export async function meetingAssignmentCount(meetingId: number, subjectId: number): Promise<number> {
  const [r] = await sql`SELECT count(*)::int AS n FROM assignments WHERE meeting_id = ${meetingId} AND subject_id = ${subjectId}`;
  return r.n as number;
}

// The subject's students (the grading rule) with their marks in this meeting: attendance and participation as given,
// assignments as the % earned in the meeting's assignments of the subject. Optionally one student only.
export async function meetingStudents(meetingId: number, semesterId: number, subjectId: number, studentId: number | null = null) {
  const rows = await sql.query(
    `SELECT g.id, concat_ws(' ', g.first_name, g.middle_name, g.last_name) AS name, g.status, g.photo IS NOT NULL AS has_photo,
       b.number, b.year, b.semester, mk.attendance, mk.participation, mk.participation_comment,
       -- assignments = % of the points possible in this meeting's assignments of the subject the student was scored in
       (SELECT round(100.0 * sum(sc.score) / sum(a.max_score))::int FROM assignments a
          JOIN assignment_scores sc ON sc.assignment_id = a.id AND sc.student_id = g.id
          WHERE a.meeting_id = $3 AND a.subject_id = $2 AND sc.score IS NOT NULL) AS assignments
     FROM (${gradedStudents()}) g
     JOIN batches b ON b.id = g.bound_batch
     LEFT JOIN class_meeting_marks mk ON mk.meeting_id = $3 AND mk.subject_id = $2 AND mk.student_id = g.id
     WHERE $4::int IS NULL OR g.id = $4
     ORDER BY g.last_name, g.first_name, g.id`,
    [semesterId, subjectId, meetingId, studentId],
  );
  return rows.map(toStudent);
}

// Saves the attendance of one meeting + subject for the students in `allowed` (the ones the subject grades now):
// a status is upserted, a blank clears it (the other marks of that row are kept). Anyone else is left untouched.
export async function saveAttendance(meetingId: number, subjectId: number, allowed: number[], marks: Map<number, Attendance | null>) {
  const ids: number[] = [], statuses: string[] = [], blanks: number[] = [];
  for (const id of allowed) {
    const a = marks.get(id);
    if (a) { ids.push(id); statuses.push(a); } else blanks.push(id);
  }
  await sql.transaction([
    sql`INSERT INTO class_meeting_marks (meeting_id, subject_id, student_id, attendance)
        SELECT ${meetingId}, ${subjectId}, x.id, x.a FROM unnest(${ids}::int[], ${statuses}::text[]) AS x(id, a)
        ON CONFLICT (meeting_id, subject_id, student_id) DO UPDATE SET attendance = EXCLUDED.attendance, updated_at = now()`,
    sql`UPDATE class_meeting_marks SET attendance = NULL, updated_at = now()
        WHERE meeting_id = ${meetingId} AND subject_id = ${subjectId} AND student_id = ANY(${blanks}::int[]) AND attendance IS NOT NULL`,
  ]);
}

// Saves participation scores and comments of one meeting + subject for the students in `allowed`; a student sent
// without a row gets both cleared. Attendance on the same row is kept; anyone else is left untouched.
export async function saveParticipation(meetingId: number, subjectId: number, allowed: number[], marks: Map<number, Participation>) {
  const ids = allowed;
  const scores = allowed.map((id) => marks.get(id)?.score ?? null);
  const comments = allowed.map((id) => marks.get(id)?.comment ?? null);
  await sql`
    INSERT INTO class_meeting_marks (meeting_id, subject_id, student_id, participation, participation_comment)
    SELECT ${meetingId}, ${subjectId}, x.id, x.score, x.note FROM unnest(${ids}::int[], ${scores}::int[], ${comments}::text[]) AS x(id, score, note)
    ON CONFLICT (meeting_id, subject_id, student_id)
    DO UPDATE SET participation = EXCLUDED.participation, participation_comment = EXCLUDED.participation_comment, updated_at = now()`;
}

// One student's assignments of this meeting + subject with their score (null = not scored) and comment.
export async function meetingStudentAssignments(meetingId: number, subjectId: number, studentId: number) {
  const rows = await sql`
    SELECT a.id, a.name, a.max_score, sc.score, sc.comment FROM assignments a
    LEFT JOIN assignment_scores sc ON sc.assignment_id = a.id AND sc.student_id = ${studentId}
    WHERE a.meeting_id = ${meetingId} AND a.subject_id = ${subjectId}
    ORDER BY a.due_on, a.name, a.id`;
  return rows.map((r) => ({
    id: r.id as number, name: r.name as string, maxScore: r.max_score as number,
    score: (r.score ?? null) as number | null, comment: (r.comment ?? null) as string | null,
  }));
}
