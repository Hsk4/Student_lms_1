import { Webhook } from "svix";
import { headers } from "next/headers";
import { connection } from "next/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { ParentInvite } from "@/models/parent-invite";
import { AuditLog } from "@/models/audit-log";

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
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", {
      status: 500,
    });
  }

  const wh = new Webhook(SIGNING_SECRET);
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as unknown as WebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  await connectDB();

  if (evt.type === "user.created") {
    const { id: clerkId, email_addresses, public_metadata } = evt.data;
    const metadata = (public_metadata ?? {}) as {
      role?: string;
      status?: string;
      onboarded?: boolean;
      studentId?: string;
      parentName?: string;
    };
    const primaryEmailId = (evt.data as typeof evt.data & { primary_email_address_id?: string | null }).primary_email_address_id;
    const primaryEmail = email_addresses?.find((address) => address.id === primaryEmailId) ?? email_addresses?.[0];
    const email = primaryEmail?.email_address?.toLowerCase() ?? "";
    const verifiedEmail = primaryEmail?.verification?.status === "verified";
    
    // If metadata has parent role and verified email, treat as parent invite
    const isParentInvite = metadata.role === "parent" && verifiedEmail && Boolean(email);

    if (isParentInvite) {
      const apiSecret = process.env.CLERK_SECRET_KEY;
      if (!apiSecret) {
        console.error("Missing CLERK_SECRET_KEY for parent invite");
        return new Response("Missing CLERK_SECRET_KEY", { status: 500 });
      }
      
      const clerk = createClerkClient({ secretKey: apiSecret });
      
      // Create parent user with role and status from invitation metadata
      const parent = await User.findOneAndUpdate(
        { clerkId },
        {
          $set: {
            email,
            name: nameOf(evt.data),
            role: "parent",
            status: "active",
            onboarded: true,
          },
          $setOnInsert: { clerkId },
        },
        { upsert: true, new: true },
      );

      console.log(`[ParentInvite] Created/updated parent: ${clerkId} (${email})`);

      // Try to find and update the student link
      try {
        const invitationList = await clerk.invitations.getInvitationList({ query: email, status: "accepted" });
        const invitedParent = invitationList.data.find(
          (item) => item.emailAddress.toLowerCase() === email && item.publicMetadata?.role === "parent"
        );

        if (invitedParent) {
          // Find Mongo invite record
          const invite = await ParentInvite.findOne({
            clerkInvitationId: invitedParent.id,
            parentEmail: email,
            state: "sent",
          }).sort({ createdAt: -1 });

          if (invite) {
            // Link parent to student
            await User.updateOne(
              { _id: invite.studentId },
              { $addToSet: { "student.guardianIds": parent._id } }
            );

            // Mark student as onboarded (parent link complete)
            await User.updateOne(
              { _id: invite.studentId },
              { $set: { onboarded: true } }
            );

            // Create audit log
            await AuditLog.create({
              actorId: parent._id,
              action: "acceptParentInvite",
              targetType: "ParentInvite",
              targetId: invite._id,
              before: { state: "sent" },
              after: { state: "accepted", studentId: String(invite.studentId) },
              at: new Date(),
            });

            // Update invite state
            invite.state = "accepted";
            invite.acceptedBy = parent._id;
            invite.acceptedAt = new Date();
            await invite.save();

            console.log(`[ParentInvite] Linked parent ${clerkId} to student ${invite.studentId}`);
          } else {
            console.warn(`[ParentInvite] No Mongo invite found for ${email} / ${invitedParent.id}`);
          }
        } else {
          console.warn(`[ParentInvite] No accepted invitation found in Clerk for ${email}`);
        }
      } catch (error) {
        console.error("[ParentInvite] Error finding/linking invitation:", error);
        // Don't fail - parent account is already created with correct role
      }
    } else {
      // Not a parent invite - create as pending user
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
    }
  } else if (evt.type === "user.updated") {
    const { id: clerkId, email_addresses, public_metadata } = evt.data;
    const metadata = (public_metadata ?? {}) as {
      role?: string;
      status?: string;
    };

    // Sync any role and status changes from Clerk (admin may have assigned role)
    const updateData: any = {
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
    if (clerkId) await User.deleteOne({ clerkId });
  }

  return new Response("Webhook processed", { status: 200 });
}
