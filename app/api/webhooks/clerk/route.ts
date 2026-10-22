import { Webhook } from "svix";
import { headers } from "next/headers";
import { connection } from "next/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";

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
    console.error('[Webhook] Missing CLERK_WEBHOOK_SIGNING_SECRET');
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", {
      status: 500,
    });
  }

  const wh = new Webhook(SIGNING_SECRET);
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  console.log('[Webhook] Headers:', { svix_id: !!svix_id, svix_timestamp: !!svix_timestamp, svix_signature: !!svix_signature });

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('[Webhook] Missing svix headers');
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  console.log('[Webhook] Body length:', body.length);
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
    console.log('[Webhook] Verified event type:', evt.type);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  // Everything below touches the database. Without this guard a connection or
  // write failure escaped as a bare 500 with no log line, which is exactly the
  // failure that was invisible in production. Clerk retries any non-2xx, so the
  // handler must be idempotent (it is: all writes are upserts or $addToSet).
  try {
    await connectDB();
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
    await User.updateOne(
      { clerkId },
      {
        $setOnInsert: {
          clerkId,
          email,
          name: nameOf(evt.data),
          role: null,
          status: "pending",
          onboarded: false,
        },
      },
      { upsert: true },
    );
  } else if (evt.type === "user.updated") {
    const { id: clerkId, email_addresses, public_metadata } = evt.data;
    const metadata = (public_metadata ?? {}) as {
      role?: string;
      status?: string;
    };

    // Sync any role and status changes from Clerk (admin may have assigned role)
    const updateData: { email: string; name: string; role?: string; status?: string; onboarded?: boolean } = {
      email: email_addresses?.[0]?.email_address ?? "",
      name: nameOf(evt.data),
    };

    // Sync role if present in Clerk metadata
    if (metadata.role) {
      updateData.role = metadata.role;
      // If parent role, mark as onboarded
      if (metadata.role === "parent") {
        updateData.onboarded = true;
      }
    }

    // Sync status if present in Clerk metadata
    if (metadata.status) {
      updateData.status = metadata.status;
    }

    await User.updateOne(
      { clerkId },
      {
        $set: updateData,
        $setOnInsert: {
          clerkId,
          role: null,
          status: "pending",
          onboarded: false,
        },
      },
      { upsert: true },
    );

    if (metadata.role || metadata.status) {
      console.log(`[Webhook] Updated user ${clerkId} - role: ${metadata.role ?? 'unchanged'}, status: ${metadata.status ?? 'unchanged'}`);
    }
  } else if (evt.type === "user.deleted") {
    const { id: clerkId } = evt.data;
    if (clerkId) {
      await User.deleteOne({ clerkId });
      console.log(`[Webhook] Deleted user ${clerkId}`);
    }
  }
}
