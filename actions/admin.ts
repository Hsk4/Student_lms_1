'use server';

import { createClerkClient } from '@clerk/backend';
import { connectDB, withTransaction } from '@/lib/db';
import { User, type IUser } from '@/models/user';
import { AccessRequest } from '@/models/access-request';
import { AuditLog } from '@/models/audit-log';
import { writeAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/guards';
import { toState, type ActionState } from '@/lib/actions';
import {
  assignRoleSchema,
  rejectUserSchema,
  requestDecisionSchema,
  userActionSchema,
} from '@/lib/validators/admin';

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('Missing CLERK_SECRET_KEY');
const clerk = createClerkClient({ secretKey });

async function updateMetadata(clerkId: string, publicMetadata: Record<string, unknown>) {
  await clerk.users.updateUser(clerkId, { publicMetadata });
}

function canManage(actorRole: 'super_admin' | 'admin', targetRole: string | null) {
  if (targetRole === 'super_admin') return false;
  if (targetRole === 'admin') return actorRole === 'super_admin';
  return true;
}

export async function assignRole(userId: string, role: string): Promise<ActionState> {
  try {
    const actor = await requireRole(['super_admin', 'admin']);
    const input = assignRoleSchema.parse({ userId, role });
    await connectDB();

    let clerkId = '';
    let before: Record<string, unknown> = {};
    await withTransaction(async (dbSession) => {
      const user = await User.findById(input.userId).session(dbSession);
      if (!user) throw new Error('User not found');
      if (!canManage(actor.role as 'super_admin' | 'admin', user.role ?? null)) throw new Error('You cannot change this user');

      clerkId = user.clerkId;
      before = { role: user.role, status: user.status, rejectedAt: user.rejectedAt, rejectionReason: user.rejectionReason };
      user.role = input.role;
      user.status = 'active';
      user.rejectedAt = undefined;
      user.rejectionReason = undefined;
      await user.save({ session: dbSession });
      await AccessRequest.updateMany(
        { userId: user._id, state: 'open' },
        { $set: { state: 'approved', decidedBy: actor.actorId, decidedAt: new Date() } },
        { session: dbSession }
      );
      await writeAudit({
        actorId: actor.actorId,
        action: 'assignRole',
        targetType: 'User',
        targetId: user._id,
        before,
        after: { role: input.role, status: 'active' },
      }, dbSession);
    });

    try {
      await updateMetadata(clerkId, { role: input.role, status: 'active' });
    } catch (error) {
      await withTransaction(async (dbSession) => {
        const user = await User.findOne({ clerkId }).session(dbSession);
        if (user) {
          user.role = (before.role as IUser['role']) ?? null;
          user.status = before.status as IUser['status'];
          user.rejectedAt = before.rejectedAt as Date | undefined;
          user.rejectionReason = before.rejectionReason as string | undefined;
          await user.save({ session: dbSession });
          await AccessRequest.updateMany(
            { userId: user._id, state: 'approved' },
            { $set: { state: 'open' }, $unset: { decidedBy: 1, decidedAt: 1 } },
            { session: dbSession }
          );
          await AuditLog.deleteOne({ targetId: user._id, action: 'assignRole', actorId: actor.actorId }).session(dbSession);
        }
      });
      throw error;
    }
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function rejectUser(userId: string, reason: string): Promise<ActionState> {
  try {
    const actor = await requireRole(['super_admin', 'admin']);
    const input = rejectUserSchema.parse({ userId, reason });
    await connectDB();

    let clerkId = '';
    let before: Record<string, unknown> = {};
    await withTransaction(async (dbSession) => {
      const user = await User.findById(input.userId).session(dbSession);
      if (!user) throw new Error('User not found');
      if (!canManage(actor.role as 'super_admin' | 'admin', user.role ?? null)) throw new Error('You cannot change this user');

      clerkId = user.clerkId;
      before = { status: user.status, rejectedAt: user.rejectedAt, rejectionReason: user.rejectionReason };
      user.status = 'rejected';
      user.rejectedAt = new Date();
      user.rejectionReason = input.reason;
      await user.save({ session: dbSession });
      await AccessRequest.updateMany(
        { userId: user._id, state: 'open' },
        { $set: { state: 'rejected', decidedBy: actor.actorId, decidedAt: new Date(), reason: input.reason } },
        { session: dbSession }
      );
      await writeAudit({ actorId: actor.actorId, action: 'rejectUser', targetType: 'User', targetId: user._id, before, after: { status: 'rejected', reason: input.reason } }, dbSession);
    });

    try {
      await updateMetadata(clerkId, { role: null, status: 'rejected' });
    } catch (error) {
      await withTransaction(async (dbSession) => {
        const user = await User.findOne({ clerkId }).session(dbSession);
        if (user) {
          user.status = before.status as IUser['status'];
          user.rejectedAt = before.rejectedAt as Date | undefined;
          user.rejectionReason = before.rejectionReason as string | undefined;
          await user.save({ session: dbSession });
          await AccessRequest.updateMany(
            { userId: user._id, state: 'rejected' },
            { $set: { state: 'open' }, $unset: { decidedBy: 1, decidedAt: 1, reason: 1 } },
            { session: dbSession }
          );
          await AuditLog.deleteOne({ targetId: user._id, action: 'rejectUser', actorId: actor.actorId }).session(dbSession);
        }
      });
      throw error;
    }
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

async function setStatus(userId: string, target: 'suspended' | 'active', action: 'suspendUser' | 'reinstateUser'): Promise<ActionState> {
  try {
    const actor = await requireRole(['super_admin', 'admin']);
    const input = userActionSchema.parse({ userId });
    await connectDB();

    let clerkId = '';
    let role: IUser['role'] = null;
    let beforeStatus: IUser['status'] = 'active';
    await withTransaction(async (dbSession) => {
      const user = await User.findById(input.userId).session(dbSession);
      if (!user) throw new Error('User not found');
      if (!canManage(actor.role as 'super_admin' | 'admin', user.role ?? null)) throw new Error('You cannot change this user');
      if (target === 'active' && !user.role) throw new Error('Assign a role before reinstating this user');

      clerkId = user.clerkId;
      role = user.role;
      beforeStatus = user.status;
      user.status = target;
      await user.save({ session: dbSession });
      await writeAudit({ actorId: actor.actorId, action, targetType: 'User', targetId: user._id, before: { status: beforeStatus }, after: { status: target } }, dbSession);
    });

    try {
      await updateMetadata(clerkId, { role, status: target });
    } catch (error) {
      await withTransaction(async (dbSession) => {
        const user = await User.findOne({ clerkId }).session(dbSession);
        if (user) {
          user.status = beforeStatus;
          await user.save({ session: dbSession });
          await AuditLog.deleteOne({ targetId: user._id, action, actorId: actor.actorId }).session(dbSession);
        }
      });
      throw error;
    }
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}

export async function suspendUser(userId: string) {
  return setStatus(userId, 'suspended', 'suspendUser');
}

export async function reinstateUser(userId: string) {
  return setStatus(userId, 'active', 'reinstateUser');
}

export async function decideAccessRequest(
  requestId: string,
  decision: 'approve' | 'reject',
  role?: string,
  reason?: string
): Promise<ActionState> {
  try {
    await requireRole(['super_admin', 'admin']);
    const input = requestDecisionSchema.parse({ requestId, decision, role, reason });
    await connectDB();
    const request = await AccessRequest.findById(input.requestId).lean();
    if (!request || request.state !== 'open') throw new Error('Open request not found');
    if (input.decision === 'approve') {
      if (!input.role) throw new Error('Pick a role to approve this request');
      return assignRole(String(request.userId), input.role);
    }
    if (!input.reason) throw new Error('Give a reason for rejecting');
    return rejectUser(String(request.userId), input.reason);
  } catch (error) {
    return toState(error);
  }
}
