'use client';

import { useState } from 'react';
import { syncUsersWithClerk } from '@/actions/sync';

export function SyncUsersButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await syncUsersWithClerk();

      if (result.ok && result.data) {
        setMessage({
          type: 'success',
          text: `Sync complete. Deleted ${result.data.deleted} user(s). ${result.data.synced} users synced with Clerk.`,
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Sync failed',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="btn-secondary"
      >
        {loading ? 'Syncing...' : 'Sync with Clerk'}
      </button>
      {message && (
        <div
          className={`text-sm font-medium ${
            message.type === 'success'
              ? 'text-status-green'
              : 'text-status-red'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
