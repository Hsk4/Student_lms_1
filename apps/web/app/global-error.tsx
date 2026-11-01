'use client';

import { useState } from 'react';

/**
 * Rendering our own global error page keeps Next.js from synthesising an
 * internal one that fails to prerender. It replaces the root layout, so it
 * renders its own document and inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, Helvetica, sans-serif',
          background: '#ffffff',
          color: '#0b1b3a',
        }}
      >
        <main style={{ maxWidth: 420, padding: '0 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: '#4a5878' }}>
            The page could not be rendered. Try again, and contact the school office if it keeps happening.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              height: 40,
              padding: '0 16px',
              borderRadius: 12,
              border: '1px solid #1e4db7',
              background: '#1e4db7',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12, color: '#4a5878' }}>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                style={{ border: 0, background: 'none', color: '#1e4db7', cursor: 'pointer' }}
              >
                Reference
              </button>
              {showDetails ? ` ${error.digest}` : null}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
