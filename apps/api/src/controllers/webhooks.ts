import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
import type { UserRole, UserStatus } from "@lms/shared";
import { db } from "@/db";
import { users } from "@/db/schema";
import { findUserByClerkId, updateUser } from "@/db/queries/users";

type ClerkUserData = {
  id: string;
  email_addresses?: { id?: string; email_address: string }[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  public_metadata?: { role?: string; status?: string; onboarded?: boolean };
};

type WebhookEvent = { type: string; data: ClerkUserData };

function nameOf(data: ClerkUserData) {
  return (
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    data.username ||
    data.email_addresses?.[0]?.email_address ||
    "User"
  );
}

/**
 * `POST /webhooks/clerk` (outside `/api/v1`, mounted before `express.json()` so
 * `req.body` is the raw Buffer svix signs). Behaviour is identical to the old
 * `app/api/webhooks/clerk` route: handlers are idempotent because Clerk retries
 * every non-2xx.
 */
export async function clerkWebhook(req: Request, res: Response) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("[Webhook] Missing CLERK_WEBHOOK_SIGNING_SECRET");
    res.status(500).send("Missing CLERK_WEBHOOK_SIGNING_SECRET");
    return;
  }

  const svixId = req.header("svix-id");
  const svixTimestamp = req.header("svix-timestamp");
  const svixSignature = req.header("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).send("Missing svix headers");
    return;
  }

  const body: Buffer | string = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : String(req.body ?? "");

  let evt: WebhookEvent;
  try {
    evt = new Webhook(signingSecret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as WebhookEvent;
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  try {
    await handleEvent(evt);
    res.status(200).send("Webhook processed");
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error(
      `[Webhook] Handling ${evt.type} for ${evt.data?.id ?? "unknown user"} failed:`,
      cause.message,
      cause.stack ?? "",
    );
    // 500 asks Clerk to retry; the handler is idempotent so a retry is safe.
    res.status(500).send("Webhook handler failed");
  }
}

async function handleEvent(evt: WebhookEvent) {
  if (evt.type === "user.created") {
    const { id: clerkId, email_addresses } = evt.data;
    const primaryEmail =
      email_addresses?.find(
        (a) => a.id === evt.data.primary_email_address_id,
      ) ?? email_addresses?.[0];
    const email = primaryEmail?.email_address?.toLowerCase() ?? "";

    // Every new account starts pending and without a role. A parent is not
    // activated by an invitation: they redeem a link code from their panel.
    await db
      .insert(users)
      .values({
        clerkId,
        email,
        name: nameOf(evt.data),
        role: null,
        status: "pending",
        onboarded: false,
      })
      .onConflictDoNothing({ target: users.clerkId });
  } else if (evt.type === "user.updated") {
    const { id: clerkId, email_addresses, public_metadata } = evt.data;
    const metadata = public_metadata ?? {};

    const existing = await findUserByClerkId(clerkId);
    if (!existing) {
      // Clerk may deliver `user.updated` before `user.created`.
      await db
        .insert(users)
        .values({
          clerkId,
          email: email_addresses?.[0]?.email_address?.toLowerCase() ?? "",
          name: nameOf(evt.data),
          role: (metadata.role as UserRole | undefined) ?? null,
          status: (metadata.status as UserStatus | undefined) ?? "pending",
          onboarded: metadata.onboarded ?? metadata.role === "parent",
        })
        .onConflictDoNothing({ target: users.clerkId });
      return;
    }

    const email = email_addresses?.[0]?.email_address?.toLowerCase();
    await updateUser(existing.id, {
      name: nameOf(evt.data),
      ...(email ? { email } : {}),
      ...(metadata.role ? { role: metadata.role as UserRole } : {}),
      ...(metadata.role === "parent" ? { onboarded: true } : {}),
      ...(metadata.status ? { status: metadata.status as UserStatus } : {}),
    });
  } else if (evt.type === "user.deleted") {
    const { id: clerkId } = evt.data;
    if (clerkId) {
      // RESTRICTed by the foreign keys: a user with history cannot vanish.
      const existing = await findUserByClerkId(clerkId);
      if (existing) {
        await db.delete(users).where(eq(users.id, existing.id));
      }
    }
  }
}
