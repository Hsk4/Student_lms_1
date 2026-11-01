import type { Request } from "express";
import { z } from "zod";
import { recordIdSchema } from "@lms/shared";
import { db } from "@/db";
import { conflict, notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import {
  findMeetingById,
  updateMeetingForTeacher,
} from "@/db/queries/meetings";
import { listMeetingsWithNamesForParent } from "@/db/queries/meetings";

/** Teacher side of meetings, plus the parent's meeting list. */

/** `POST /api/v1/teacher/meetings/:id/confirm` */
export async function confirmMeeting(req: Request) {
  const actor = actorOf(req);
  const input = z
    .object({ confirmedAt: z.string().datetime() })
    .parse(req.body);
  const meetingId = recordIdSchema.parse(req.params.id);

  await db.transaction(async (tx) => {
    const meeting = await findMeetingById(meetingId, tx);
    if (!meeting || meeting.teacherId !== actor.id)
      throw notFound("Meeting not found");
    if (meeting.state === "cancelled" || meeting.state === "done") {
      throw conflict("This meeting is already closed");
    }

    const wasConfirmed = Boolean(meeting.confirmedAt);
    const confirmedAt = new Date(input.confirmedAt);
    const nextState = wasConfirmed ? "rescheduled" : "confirmed";

    const changed = await updateMeetingForTeacher(
      meeting.id,
      actor.id,
      { confirmedAt, state: nextState },
      tx,
    );
    if (!changed) throw notFound("Meeting not found");

    await writeAudit(
      {
        actorId: actor.id,
        action: "confirmMeeting",
        targetType: "Meeting",
        targetId: meeting.id,
        before: { state: meeting.state, confirmedAt: meeting.confirmedAt },
        after: { state: nextState, confirmedAt },
      },
      { tx },
    );
  });
}

/** `POST /api/v1/teacher/meetings/:id/request-slot` */
export async function requestNewSlot(req: Request) {
  const actor = actorOf(req);
  const meetingId = recordIdSchema.parse(req.params.id);

  await db.transaction(async (tx) => {
    const meeting = await findMeetingById(meetingId, tx);
    if (!meeting || meeting.teacherId !== actor.id)
      throw notFound("Meeting not found");
    if (meeting.state === "cancelled" || meeting.state === "done") {
      throw conflict("This meeting is already closed");
    }

    const changed = await updateMeetingForTeacher(
      meeting.id,
      actor.id,
      { state: "requested", confirmedAt: null },
      tx,
    );
    if (!changed) throw notFound("Meeting not found");

    await writeAudit(
      {
        actorId: actor.id,
        action: "requestNewSlot",
        targetType: "Meeting",
        targetId: meeting.id,
        before: { state: meeting.state, confirmedAt: meeting.confirmedAt },
        after: { state: "requested", confirmedAt: null },
      },
      { tx },
    );
  });
}

/** `GET /api/v1/parent/meetings` — the parent's own meetings. */
export async function parentMeetings(req: Request) {
  return listMeetingsWithNamesForParent(actorOf(req).id);
}
