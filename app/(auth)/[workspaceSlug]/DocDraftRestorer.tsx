'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Detects ?restore_doc=<id> (or the qcp_doc_draft cookie) on the
 * dashboard, loads the matching draft and calls the import API to create
 * the entity.
 *
 * Draft sources, in order:
 *   1. localStorage (same-origin fast path)
 *   2. GET /api/free-tools/drafts/<id> — the server-side copy. This is
 *      what makes the free-tools → app journey survive the
 *      quote-core.com → app.quote-core.com origin change (localStorage
 *      does not cross origins).
 */
function clearDraftCookie() {
  document.cookie = 'qcp_doc_draft=; path=/; max-age=0';
  const h = window.location.hostname.toLowerCase();
  if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
    document.cookie = 'qcp_doc_draft=; path=/; max-age=0; domain=.quote-core.com';
  }
}

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
    // NOTE: the cookie is only cleared AFTER a successful import — an
    // earlier version cleared it on read, so a failed first attempt
    // destroyed the pointer and the draft was unrecoverable.
    let draftId = urlDraftId;
    if (!draftId) {
      const match = document.cookie.match(/qcp_doc_draft=([^;]+)/);
      if (match) draftId = decodeURIComponent(match[1]);
    }
    if (!draftId) return;
    const id = draftId;

    setStatus('loading');
    const key = `qcp:doc-draft:${id}`;

    (async () => {
      try {
        // 1. Same-origin fast path
        let draftData: unknown = null;
        try {
          const raw = localStorage.getItem(key);
          if (raw) draftData = JSON.parse(raw);
        } catch {}

        // 2. Server-side copy (cross-origin journeys land here)
        if (!draftData) {
          const res = await fetch(`/api/free-tools/drafts/${id}`);
          if (res.ok) {
            const json = await res.json();
            if (json?.draftType === 'document') draftData = json.payload;
          }
        }

        if (!draftData) {
          setStatus('error');
          setErrorMessage('Draft not found. It may have expired.');
          clearDraftCookie();
          return;
        }

        const res = await fetch('/api/app/import-free-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: id, draftData }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Import failed' }));
          throw new Error(err.error || 'Import failed');
        }
        const result = await res.json();

        // Success — clean up all draft pointers
        try { localStorage.removeItem(key); } catch {}
        clearDraftCookie();
        fetch(`/api/free-tools/drafts/${id}`, { method: 'DELETE' }).catch(() => {});

        if (result.redirectUrl) {
          router.push(result.redirectUrl);
        } else {
          router.push(`/${workspaceSlug}`);
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to import document');
      }
    })();
  }, [urlDraftId, router, workspaceSlug]);

  // Show the restorer UI when we have a URL param OR a cookie-triggered draft
  if (!urlDraftId && status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 px-2 py-2 md:px-4 md:py-3 rounded-xl border border-blue-200 bg-blue-50">
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
      <div className="flex items-center gap-3 px-2 py-2 md:px-4 md:py-3 rounded-xl border border-red-200 bg-red-50">
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
