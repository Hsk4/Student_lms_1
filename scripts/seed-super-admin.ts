#!/usr/bin/env node

import { createClerkClient } from '@clerk/backend';
import { connectDB, withTransaction } from '../lib/db';
import { User } from '../models/user';

const email = process.argv[2];

if (!email) {
  console.error('Usage: bun scripts/seed-super-admin.ts <email>');
  process.exit(1);
}

async function seedSuperAdmin() {
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

  if (!CLERK_SECRET_KEY) {
    throw new Error('Missing CLERK_SECRET_KEY environment variable');
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  console.log(`Looking up Clerk user with email: ${email}`);

  // Find user by email
  const users = await clerk.users.getUserList({ emailAddress: [email] });

  if (!users.data || users.data.length === 0) {
    console.error(`No Clerk user found with email: ${email}`);
    process.exit(1);
  }

  const clerkUser = users.data[0];

  // Check email is verified
  if (
    !clerkUser.emailAddresses.some(
      (ea) => ea.emailAddress === email && ea.verification?.status === 'verified'
    )
  ) {
    console.error(`Email ${email} is not verified in Clerk`);
    process.exit(1);
  }

  console.log(`Found Clerk user: ${clerkUser.id}`);

  // Set super_admin role and status in Clerk publicMetadata
  await clerk.users.updateUser(clerkUser.id, {
    publicMetadata: {
      role: 'super_admin',
      status: 'active',
    },
  });

  console.log('Updated Clerk publicMetadata');

  // Connect to MongoDB and create/update User record
  await connectDB();

  await withTransaction(async (session) => {
    const existingUser = await User.findOne({ clerkId: clerkUser.id }).session(session);

    if (existingUser) {
      existingUser.role = 'super_admin';
      existingUser.status = 'active';
      await existingUser.save({ session });
      console.log(`Updated existing User record: ${existingUser._id}`);
    } else {
      const newUser = new User({
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0].emailAddress,
        name: clerkUser.firstName || clerkUser.username || 'Super Admin',
        role: 'super_admin',
        status: 'active',
      });

      await newUser.save({ session });
      console.log(`Created new User record: ${newUser._id}`);
    }
  });

  console.log(`✓ Super admin created/updated: ${email}`);
  process.exit(0);
}

seedSuperAdmin().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
