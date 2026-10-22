"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Meeting } from "@/models/meeting";
import { requireRole } from "@/lib/auth/guards";
import { objectIdSchema } from "@/lib/validators/common";
import { toState, type ActionState } from "@/lib/actions";

const meetingSchema = z.object({ meetingId: objectIdSchema });

/** Confirm or move a parent meeting. Only the teacher of the meeting can act. */
export async function confirmMeeting(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requireRole(["teacher"]);
    const input = z
      .object({ meetingId: objectIdSchema, confirmedAt: z.string().datetime() })
      .parse(raw);
    await connectDB();

    const meeting = await Meeting.findOne({
      _id: input.meetingId,
      teacherId: actor.actorId,
    });
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.state === "cancelled" || meeting.state === "done") {
      throw new Error("This meeting is already closed");
    }

    const wasConfirmed = Boolean(meeting.confirmedAt);
    meeting.confirmedAt = new Date(input.confirmedAt);
    meeting.state = wasConfirmed ? "rescheduled" : "confirmed";
    await meeting.save();

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
    await connectDB();

    const meeting = await Meeting.findOne({
      _id: input.meetingId,
      teacherId: actor.actorId,
    });
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.state === "cancelled" || meeting.state === "done") {
      throw new Error("This meeting is already closed");
    }

    meeting.state = "requested";
    meeting.confirmedAt = undefined;
    await meeting.save();

    revalidatePath("/teacher/meetings");
    revalidatePath("/parent/meetings");
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
