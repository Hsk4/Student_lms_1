'use client';

import { useState } from 'react';
import { getParentDebugInfo } from '@/actions/debug';
import { manuallyLinkParentToStudent } from '@/actions/manual-link';

export function ParentDebugButton() {
  const [debug, setDebug] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDebug = async () => {
    setLoading(true);
    const result = await getParentDebugInfo();
    setDebug(result);
    setLoading(false);
  };

  const handleLink = async (inviteId: string, studentName: string) => {
    setLinking(inviteId);
    setMessage(null);

    const result = await manuallyLinkParentToStudent(inviteId);
    if (result.ok) {
      setMessage({
        type: 'success',
        text: `Linked to ${studentName}! Refresh page to see changes.`,
      });
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to link' });
    }
    setLinking(null);
  };

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-yellow-500 bg-yellow-50 p-4">
      <button onClick={handleDebug} disabled={loading} className="btn-secondary text-sm">
        {loading ? 'Loading...' : 'Show Debug Info'}
      </button>

      {message && (
        <p
          className={`text-sm font-medium ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}

      {debug && (
        <>
          <details className="text-xs">
            <summary className="cursor-pointer font-mono">Debug Output</summary>
            <pre className="mt-2 overflow-auto rounded bg-black p-3 text-white text-xs">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </details>

          {debug.invites && debug.invites.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold">Pending Invites:</p>
              {debug.invites.map((invite: any) => (
                <div key={invite.id} className="flex items-center justify-between rounded bg-white p-2">
                  <div className="text-xs">
                    <p className="font-medium">{invite.studentName || 'Unknown'}</p>
                    <p className="text-gray-500">{invite.state}</p>
                  </div>
                  {invite.state === 'sent' && (
                    <button
                      onClick={() => handleLink(invite.id, invite.studentName)}
                      disabled={linking === invite.id}
                      className="btn-secondary text-xs h-8"
                    >
                      {linking === invite.id ? 'Linking...' : 'Link Now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
