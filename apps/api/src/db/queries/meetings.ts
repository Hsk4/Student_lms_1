import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import { meetings, users } from "@/db/schema";
import type { Id, Meeting, MeetingState } from "@/db/types";

/**
 * Parent/teacher meetings. Postgres-backed.
 *
 * `requestedSlots` stays `jsonb` (`string[]`) because it is proposed and read
 * whole; nothing queries inside it. The `.$type<string[]>()` on the column means
 * the driver round-trips the array as-is, so no parsing lives here.
 */

type MeetingRow = typeof meetings.$inferSelect;

// Two aliases because one meeting joins `users` twice: teacher and student.
const teacher = alias(users, "teacher");
const student = alias(users, "student");

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    parentId: row.parentId,
    teacherId: row.teacherId,
    studentId: row.studentId,
    requestedSlots: row.requestedSlots ?? [],
    confirmedAt: row.confirmedAt,
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findMeetingById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Meeting | null> {
  const [row] = await conn
    .select()
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1);
  return row ? toMeeting(row) : null;
}

export async function listMeetingsForTeacher(
  teacherId: Id,
  conn: Tx | typeof db = db,
): Promise<Meeting[]> {
  const rows = await conn
    .select()
    .from(meetings)
    .where(eq(meetings.teacherId, teacherId))
    .orderBy(desc(meetings.createdAt));
  return rows.map(toMeeting);
}

export async function listMeetingsForParent(
  parentId: Id,
  conn: Tx | typeof db = db,
): Promise<Meeting[]> {
  const rows = await conn
    .select()
    .from(meetings)
    .where(eq(meetings.parentId, parentId))
    .orderBy(desc(meetings.createdAt));
  return rows.map(toMeeting);
}

/**
 * Parent meetings page: each meeting plus the teacher and child names, so the
 * page renders one read instead of two `populate`s.
 */
export async function listMeetingsWithNamesForParent(
  parentId: Id,
  conn: Tx | typeof db = db,
): Promise<MeetingForParent[]> {
  const rows = await conn
    .select({
      meeting: meetings,
      teacherName: teacher.name,
      teacherEmail: teacher.email,
      studentName: student.name,
    })
    .from(meetings)
    .innerJoin(teacher, eq(teacher.id, meetings.teacherId))
    .innerJoin(student, eq(student.id, meetings.studentId))
    .where(eq(meetings.parentId, parentId))
    .orderBy(desc(meetings.createdAt));

  return rows.map((row) => ({
    ...toMeeting(row.meeting),
    teacherName: row.teacherName,
    teacherEmail: row.teacherEmail,
    studentName: row.studentName,
  }));
}

export type MeetingForParent = Meeting & {
  teacherName: string;
  teacherEmail: string;
  studentName: string;
};

export async function createMeeting(
  input: {
    parentId: Id;
    teacherId: Id;
    studentId: Id;
    requestedSlots: string[];
  },
  conn: Tx | typeof db = db,
): Promise<Meeting> {
  const [row] = await conn
    .insert(meetings)
    .values({
      parentId: input.parentId,
      teacherId: input.teacherId,
      studentId: input.studentId,
      requestedSlots: input.requestedSlots,
      state: "requested",
    })
    .returning();
  return toMeeting(row);
}

export async function updateMeeting(
  id: Id,
  input: Partial<{
    state: MeetingState;
    confirmedAt: Date | null;
    requestedSlots: string[];
  }>,
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn.update(meetings).set(input).where(eq(meetings.id, id));
}

/** Guarded update: only the owning teacher may move the meeting. */
export async function updateMeetingForTeacher(
  id: Id,
  teacherId: Id,
  input: Partial<{
    state: MeetingState;
    confirmedAt: Date | null;
    requestedSlots: string[];
  }>,
  conn: Tx | typeof db = db,
): Promise<boolean> {
  const updated = await conn
    .update(meetings)
    .set(input)
    .where(and(eq(meetings.id, id), eq(meetings.teacherId, teacherId)))
    .returning({ id: meetings.id });
  return updated.length > 0;
}
