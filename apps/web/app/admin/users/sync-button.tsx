'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { syncUsersWithClerk } from '@/actions/sync';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/nila';

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
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleSync}
        disabled={loading}
      >
        <RefreshCw className={loading ? 'animate-spin' : undefined} />
        {loading ? 'Syncing...' : 'Sync with Clerk'}
      </Button>
      {message ? (
        <Notice tone={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Notice>
      ) : null}
    </div>
  );
}
