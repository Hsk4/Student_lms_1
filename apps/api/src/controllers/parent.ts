import type { Request } from "express";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { recordIdSchema, redeemLinkCodeSchema, studentParentSchema } from "@lms/shared";
import { db } from "@/db";
import { parentInvites } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  LINK_CODE_TTL_DAYS,
  normalizeLinkCode,
  uniqueLinkCode,
} from "@/lib/link-codes";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http-error";
import { actorOf } from "@/middleware/auth";
import {
  createInvite,
  findInviteByCode,
  findInviteById,
} from "@/db/queries/parent-invites";
import {
  linkParentToStudent,
  listParentIdsForStudent,
} from "@/db/queries/guardianships";
import { findUserByEmail, findUserById } from "@/db/queries/users";

/**
 * Parent linking by short code. There is no Clerk invitation anywhere in this
 * flow: the student issues a code, the parent redeems it inside their own
 * panel, and a `guardianships` row records the link.
 */

/** Codes are 8 chars from a 23-letter alphabet; this cap makes guessing useless. */
const MAX_ATTEMPTS = 10;

/** `POST /api/v1/student/parent-links` */
export async function createParentLink(req: Request) {
  const actor = actorOf(req);
  if (actor.role !== "student" || actor.status !== "active") {
    throw forbidden("Student account not found");
  }
  const input = studentParentSchema.parse(req.body);

  const alreadyLinked = await listParentIdsForStudent(actor.id);
  if (alreadyLinked.length >= 5) {
    throw conflict("You already have the maximum number of guardians linked");
  }

  if (input.parentEmail) {
    const existing = await findUserByEmail(input.parentEmail);
    if (existing) {
      throw conflict(
        "That email already has an account. They should sign in and enter your link code from their own panel.",
      );
    }
  }

  const code = await uniqueLinkCode();
  const expiresAt = new Date(
    Date.now() + LINK_CODE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const invite = await db.transaction(async (tx) => {
    const created = await createInvite(
      {
        studentId: actor.id,
        parentName: input.parentName,
        parentEmail: input.parentEmail ?? "",
        code,
        expiresAt,
      },
      tx,
    );

    await writeAudit(
      {
        actorId: actor.id,
        action: "createParentLink",
        targetType: "ParentInvite",
        targetId: created.id,
        after: {
          studentId: actor.id,
          parentName: input.parentName,
          code,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { tx },
    );

    return created;
  });

  return { code: invite.code, expiresAt: expiresAt.toISOString() };
}

/** `POST /api/v1/student/parent-links/:id/revoke` */
export async function revokeParentLink(req: Request) {
  const actor = actorOf(req);
  const id = String(req.params.id);

  await db.transaction(async (tx) => {
    const invite = await findInviteById(recordIdSchema.optional().parse(id) ?? "", tx);
    if (!invite || invite.studentId !== actor.id || invite.state !== "sent") {
      throw notFound("That code is no longer active");
    }

    await tx
      .update(parentInvites)
      .set({ state: "revoked" })
      .where(eq(parentInvites.id, invite.id));

    await writeAudit(
      {
        actorId: actor.id,
        action: "revokeParentLink",
        targetType: "ParentInvite",
        targetId: invite.id,
        before: { state: "sent" },
        after: { state: "revoked" },
      },
      { tx },
    );
  });
}

/**
 * `POST /api/v1/parent/parent-links/redeem`
 *
 * The student is resolved from the code, never from the client. The link is
 * claimed atomically (`UPDATE ... WHERE state = 'sent'`), so two browser tabs
 * cannot both win. A failed guess counts against the code, never fails twice.
 */
export async function redeemLinkCode(req: Request) {
  const actor = actorOf(req);
  const parsed = redeemLinkCodeSchema.safeParse(req.body ?? {});
  const rawCode = (req.body as { code?: unknown } | undefined)?.code;

  try {
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join(". "));
    }
    const normalized = normalizeLinkCode(parsed.data.code);
    if (normalized.length !== 8) {
      throw conflict(
        "A link code is 8 characters. Check the code your child gave you.",
      );
    }

    const invite = await findInviteByCode(normalized);
    if (!invite) throw notFound("That code does not match any student.");
    if (invite.state === "accepted")
      throw conflict("This code has already been used.");
    if (invite.state === "revoked") {
      throw conflict("This code was cancelled by the student.");
    }
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw conflict("This code has expired. Ask your child for a new one.");
    }
    if (invite.attempts >= MAX_ATTEMPTS) {
      throw conflict(
        "Too many attempts on this code. Ask your child for a new one.",
      );
    }
    if (invite.studentId === actor.id) {
      throw conflict("You cannot link your own account as your parent.");
    }

    const [student, parent] = await Promise.all([
      findUserById(invite.studentId),
      findUserById(actor.id),
    ]);
    if (!student || student.role !== "student" || student.status !== "active") {
      throw notFound("That student account is no longer active.");
    }

    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(parentInvites)
        .set({
          state: "accepted",
          acceptedBy: actor.id,
          acceptedAt: new Date(),
          parentEmail: parent?.email ?? invite.parentEmail,
        })
        .where(
          and(eq(parentInvites.id, invite.id), eq(parentInvites.state, "sent")),
        )
        .returning({ id: parentInvites.id });

      if (claimed.length === 0)
        throw conflict("This code has already been used.");

      await linkParentToStudent(
        actor.id,
        invite.studentId,
        { markOnboarded: true },
        tx,
      );

      await writeAudit(
        {
          actorId: actor.id,
          action: "redeemParentLink",
          targetType: "ParentInvite",
          targetId: invite.id,
          before: { state: "sent" },
          after: {
            state: "accepted",
            studentId: invite.studentId,
            parentId: actor.id,
          },
        },
        { tx },
      );
    });

    return { id: student.id, name: student.name };
  } catch (error) {
    // Count a failed guess, but never fail the response over it.
    try {
      if (typeof rawCode === "string") {
        await db
          .update(parentInvites)
          .set({
            attempts: sql`${parentInvites.attempts} + 1`,
            lastAttemptAt: new Date(),
          })
          .where(
            and(
              eq(parentInvites.code, normalizeLinkCode(rawCode)),
              eq(parentInvites.state, "sent"),
            ),
          );
      }
    } catch (countError) {
      console.error(
        "[parent-link] Could not record a failed attempt:",
        countError,
      );
    }
    throw error;
  }
}

export type GuardianRow = {
  id: string;
  name: string | null;
  email: string;
  state: "active" | "sent" | "expired" | "revoked";
  code?: string;
  expiresAt?: string;
};

/** `GET /api/v1/student/guardians` — linked accounts first, then open codes. */
export async function listMyGuardians(req: Request): Promise<GuardianRow[]> {
  const actor = actorOf(req);

  const [parentIds, invites] = await Promise.all([
    listParentIdsForStudent(actor.id),
    db
      .select()
      .from(parentInvites)
      .where(
        and(
          eq(parentInvites.studentId, actor.id),
          ne(parentInvites.state, "accepted"),
        ),
      )
      .orderBy(desc(parentInvites.createdAt)),
  ]);

  const parents = await Promise.all(parentIds.map((id) => findUserById(id)));

  const rows: GuardianRow[] = parents
    .filter((parent): parent is NonNullable<typeof parent> => Boolean(parent))
    .map((parent) => ({
      id: parent.id,
      name: parent.name,
      email: parent.email,
      state: "active",
    }));

  for (const invite of invites) {
    const expired = invite.expiresAt ? invite.expiresAt <= new Date() : false;
    const state =
      invite.state === "revoked" ? "revoked" : expired ? "expired" : "sent";
    rows.push({
      id: invite.id,
      name: invite.parentName,
      email: invite.parentEmail,
      state,
      code: state === "sent" ? invite.code : undefined,
      expiresAt: invite.expiresAt?.toISOString(),
    });
  }

  return rows;
}
