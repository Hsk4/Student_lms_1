'use client';

import { useState } from 'react';
import { revokeParentInvite, resendParentInvite } from '@/actions/parent-invites';

export function InviteActions({ inviteId, parentEmail }: { inviteId: string; parentEmail: string }) {
  const [loading, setLoading] = useState<'revoke' | 'resend' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRevoke = async () => {
    setLoading('revoke');
    setMessage(null);

    const result = await revokeParentInvite(inviteId);
    if (result.ok) {
      setMessage({ type: 'success', text: 'Invitation revoked.' });
      // Reload page after a short delay
      setTimeout(() => window.location.reload(), 500);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to revoke' });
    }
    setLoading(null);
  };

  const handleResend = async () => {
    setLoading('resend');
    setMessage(null);

    const result = await resendParentInvite(inviteId);
    if (result.ok) {
      setMessage({ type: 'success', text: `New link sent to ${parentEmail}` });
      setTimeout(() => window.location.reload(), 500);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to resend' });
    }
    setLoading(null);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={handleRevoke}
          disabled={loading === 'revoke'}
          className="btn-ghost h-8 text-xs"
        >
          {loading === 'revoke' ? 'Revoking...' : 'Revoke'}
        </button>
        <button
          onClick={handleResend}
          disabled={loading === 'resend'}
          className="btn-ghost h-8 text-xs"
        >
          {loading === 'resend' ? 'Resending...' : 'Resend'}
        </button>
      </div>
      {message && (
        <p
          className={`text-xs font-medium ${
            message.type === 'success' ? 'text-status-green' : 'text-status-red'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
