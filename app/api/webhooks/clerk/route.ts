import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SIGNING_SECRET');
  }

  const wh = new Webhook(SIGNING_SECRET);
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const body = await req.text();
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as unknown as WebhookEvent;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  const eventType = evt.type;
  console.log(`Webhook event received: ${eventType}`);

  if (eventType === 'user.created') {
    console.log(`User created: ${evt.data.id}`);
  } else if (eventType === 'user.updated') {
    console.log(`User updated: ${evt.data.id}`);
  } else if (eventType === 'user.deleted') {
    console.log(`User deleted: ${evt.data.id}`);
  }

  return new Response('Webhook received', { status: 200 });
}
