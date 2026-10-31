"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import {
  findMeetingById,
  updateMeetingForTeacher,
} from "@/lib/queries/meetings";
import { recordIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const meetingSchema = z.object({ meetingId: recordIdSchema });

/** Confirm or move a parent meeting. Only the teacher of the meeting can act. */
export async function confirmMeeting(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = z
      .object({
        meetingId: recordIdSchema,
        confirmedAt: z.string().datetime(),
      })
      .parse(raw);

    await db.transaction(async (tx) => {
      const meeting = await findMeetingById(input.meetingId, tx);
      if (!meeting || meeting.teacherId !== actor.actorId) {
        throw new Error("Meeting not found");
      }
      if (meeting.state === "cancelled" || meeting.state === "done") {
        throw new Error("This meeting is already closed");
      }

      const wasConfirmed = Boolean(meeting.confirmedAt);
      const confirmedAt = new Date(input.confirmedAt);
      const nextState = wasConfirmed ? "rescheduled" : "confirmed";

      const changed = await updateMeetingForTeacher(
        meeting.id,
        actor.actorId,
        { confirmedAt, state: nextState },
        tx,
      );
      if (!changed) throw new Error("Meeting not found");

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "confirmMeeting",
          targetType: "Meeting",
          targetId: meeting.id,
          before: { state: meeting.state, confirmedAt: meeting.confirmedAt },
          after: { state: nextState, confirmedAt },
        },
        { tx },
      );
    });

    revalidatePath("/teacher/meetings");
    revalidatePath("/parent/meetings");
    revalidatePath("/parent");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

/** Teacher asks the parent for another slot, clearing the confirmed time. */
export async function requestNewSlot(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = meetingSchema.parse(raw);

    await db.transaction(async (tx) => {
      const meeting = await findMeetingById(input.meetingId, tx);
      if (!meeting || meeting.teacherId !== actor.actorId) {
        throw new Error("Meeting not found");
      }
      if (meeting.state === "cancelled" || meeting.state === "done") {
        throw new Error("This meeting is already closed");
      }

      const changed = await updateMeetingForTeacher(
        meeting.id,
        actor.actorId,
        { state: "requested", confirmedAt: null },
        tx,
      );
      if (!changed) throw new Error("Meeting not found");

      await writeAudit(
        {
          actorId: actor.actorId,
          action: "requestNewSlot",
          targetType: "Meeting",
          targetId: meeting.id,
          before: {
            state: meeting.state,
            confirmedAt: meeting.confirmedAt,
          },
          after: { state: "requested", confirmedAt: null },
        },
        { tx },
      );
    });

    revalidatePath("/teacher/meetings");
    revalidatePath("/parent/meetings");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
