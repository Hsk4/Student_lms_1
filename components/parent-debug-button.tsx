'use client';

import { useState } from 'react';
import { getParentDebugInfo } from '@/actions/debug';

export function ParentDebugButton() {
  const [debug, setDebug] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleDebug = async () => {
    setLoading(true);
    const result = await getParentDebugInfo();
    setDebug(result);
    setLoading(false);
  };

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-yellow-500 bg-yellow-50 p-4">
      <button onClick={handleDebug} disabled={loading} className="btn-secondary text-sm">
        {loading ? 'Loading...' : 'Show Debug Info'}
      </button>

      {debug && (
        <details className="text-xs">
          <summary className="cursor-pointer font-mono">Debug Output</summary>
          <pre className="mt-2 overflow-auto rounded bg-black p-3 text-white text-xs">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
