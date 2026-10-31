import { Webhook } from "svix";
import { headers } from "next/headers";
import { connection } from "next/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { findUserByClerkId, updateUser } from "@/lib/queries/users";
import type { UserRole, UserStatus } from "@/lib/types";

function nameOf(data: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email_addresses?: { email_address: string }[];
}) {
  return (
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    data.username ||
    data.email_addresses?.[0]?.email_address ||
    "User"
  );
}

/** Handlers are idempotent: Clerk retries on any non-2xx response. */
export async function POST(req: Request) {
  await connection();
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    console.error("[Webhook] Missing CLERK_WEBHOOK_SIGNING_SECRET");
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", {
      status: 500,
    });
  }

  const wh = new Webhook(SIGNING_SECRET);
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  console.log("[Webhook] Headers:", {
    svix_id: !!svix_id,
    svix_timestamp: !!svix_timestamp,
    svix_signature: !!svix_signature,
  });

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("[Webhook] Missing svix headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  console.log("[Webhook] Body length:", body.length);
  let evt: WebhookEvent;

  try {
    const verified = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
    if (!verified) {
      console.error("[Webhook] Verification returned falsy value");
      return new Response("Webhook verification failed", { status: 400 });
    }
    evt = verified as unknown as WebhookEvent;
    console.log("[Webhook] Verified event type:", evt.type);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  // Everything below touches the database. Without this guard a connection or
  // write failure escaped as a bare 500 with no log line, which is exactly the
  // failure that was invisible in production. Clerk retries any non-2xx, so the
  // handler must be idempotent — every write below is an upsert.
  try {
    await handleEvent(evt);
    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error(
      `[Webhook] Handling ${evt.type} for ${evt.data?.id ?? "unknown user"} failed:`,
      cause.message,
      cause.stack ?? "",
    );
    // 500 asks Clerk to retry; the handler is idempotent so a retry is safe.
    return new Response("Webhook handler failed", { status: 500 });
  }
}

async function handleEvent(evt: WebhookEvent) {
  if (evt.type === "user.created") {
    const { id: clerkId, email_addresses } = evt.data;
    const primaryEmailId = (
      evt.data as typeof evt.data & { primary_email_address_id?: string | null }
    ).primary_email_address_id;
    const primaryEmail =
      email_addresses?.find((address) => address.id === primaryEmailId) ??
      email_addresses?.[0];
    const email = primaryEmail?.email_address?.toLowerCase() ?? "";

    // Every new account starts pending and without a role. A parent is no
    // longer activated by an invitation: they redeem a link code from inside
    // their own panel (`redeemLinkCode`), so no role is granted here.
    //
    // `onConflictDoNothing` is the Postgres form of `$setOnInsert` + upsert: a
    // retried `user.created` must not reset a role an admin already assigned.
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
    const metadata = (public_metadata ?? {}) as {
      role?: string;
      status?: string;
      onboarded?: boolean;
    };

    const existing = await findUserByClerkId(clerkId);

    if (!existing) {
      // Clerk may deliver `user.updated` before `user.created`. Insert the row
      // with the metadata applied rather than dropping the event.
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

    // The column has a CHECK that the email is lowercase.
    const email = email_addresses?.[0]?.email_address?.toLowerCase();

    await updateUser(existing.id, {
      name: nameOf(evt.data),
      ...(email ? { email } : {}),
      ...(metadata.role ? { role: metadata.role as UserRole } : {}),
      ...(metadata.role === "parent" ? { onboarded: true } : {}),
      ...(metadata.status ? { status: metadata.status as UserStatus } : {}),
    });

    if (metadata.role || metadata.status) {
      console.log(
        `[Webhook] Updated user ${clerkId} - role: ${metadata.role ?? "unchanged"}, status: ${metadata.status ?? "unchanged"}`,
      );
    }
  } else if (evt.type === "user.deleted") {
    const { id: clerkId } = evt.data;
    if (clerkId) {
      // Deletion is RESTRICTed by the foreign keys, so a user with history
      // (enrollments, invoices, audit rows) cannot vanish. The admin `sync`
      // action reports those instead of silently orphaning records.
      const existing = await findUserByClerkId(clerkId);
      if (existing) {
        await db.delete(users).where(eq(users.id, existing.id));
        console.log(`[Webhook] Deleted user ${clerkId}`);
      }
    }
  }
}
