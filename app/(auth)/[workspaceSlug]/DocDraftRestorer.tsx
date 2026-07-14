'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Detects ?restore_doc=<id> on the dashboard, reads the matching draft
 * from localStorage, and calls the import API to create the entity.
 * Shows a loading state while processing and error states if needed.
 */
export function DocDraftRestorer({ workspaceSlug }: { workspaceSlug: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const urlDraftId = searchParams.get('restore_doc');

  useEffect(() => {
    // Check URL param first, then fall back to the qcp_doc_draft cookie
    // (set by SaveToAppButton when redirecting to signup). This ensures
    // the draft is restored even if the URL param was lost during
    // signup → email confirmation → onboarding → dashboard navigation.
    let draftId = urlDraftId;
    if (!draftId) {
      const match = document.cookie.match(/qcp_doc_draft=([^;]+)/);
      if (match) {
        draftId = decodeURIComponent(match[1]);
        // Clean up the cookie so it doesn't trigger on every dashboard visit
        document.cookie = 'qcp_doc_draft=; path=/; max-age=0';
      }
    }
    if (!draftId) return;

    setStatus('loading');
    const key = `qcp:doc-draft:${draftId}`;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setStatus('error');
        setErrorMessage('Draft not found. It may have expired.');
        return;
      }

      const draftData = JSON.parse(raw);

      // Call the import API
      fetch('/api/app/import-free-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, draftData }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Import failed' }));
            throw new Error(err.error || 'Import failed');
          }
          return res.json();
        })
        .then((result) => {
          // Clean up localStorage
          try { localStorage.removeItem(key); } catch {}
          // Redirect to the editor
          if (result.redirectUrl) {
            router.push(result.redirectUrl);
          } else {
            router.push(`/${workspaceSlug}`);
          }
        })
        .catch((err) => {
          setStatus('error');
          setErrorMessage(err.message || 'Failed to import document');
        });
    } catch {
      setStatus('error');
      setErrorMessage('Failed to read draft data.');
    }
  }, [urlDraftId, router, workspaceSlug]);

  // Show the restorer UI when we have a URL param OR a cookie-triggered draft
  if (!urlDraftId && status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50">
        <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-800">Importing your document...</p>
          <p className="text-xs text-blue-600">Creating your document in the app.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50">
        <div className="flex-shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">Import failed</p>
          <p className="text-xs text-red-600">{errorMessage}</p>
        </div>
        <button
          onClick={() => router.push(`/${workspaceSlug}`)}
          className="px-4 py-2 text-sm font-medium rounded-full border border-red-300 text-red-700 hover:bg-red-100 transition"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  return null;
}
