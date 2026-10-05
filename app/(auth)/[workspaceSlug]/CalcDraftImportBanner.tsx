'use client';

import { useState } from 'react';

/**
 * Blue "Your components are ready to add" banner on the dashboard (H-03).
 * Server-rendered state comes from the qcp_signup_draft cookie; the
 * dismiss (X) clears that cookie client-side so the banner goes away
 * without importing the components. The draft itself stays on the
 * server, so the choice is reversible until the draft expires.
 */
export function CalcDraftImportBanner({
  draftId,
  sourceRef,
}: {
  draftId: string;
  sourceRef: string | null;
}) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    document.cookie = 'qcp_signup_draft=; path=/; max-age=0';
    document.cookie = 'qcp_signup_ref=; path=/; max-age=0';
    const h = window.location.hostname.toLowerCase();
    if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
      document.cookie = 'qcp_signup_draft=; path=/; max-age=0; domain=.quote-core.com';
      document.cookie = 'qcp_signup_ref=; path=/; max-age=0; domain=.quote-core.com';
    }
  };

  const toolLabel = sourceRef
    ? sourceRef.replace(/-/g, ' ').replace(/^free /, '')
    : 'free tool';

  return (
    <div className="flex items-center gap-3 px-3 py-3 md:px-4 rounded-xl border border-blue-200 bg-blue-50">
      <div className="flex-shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-800">
          Your components are ready to add
        </p>
        <p className="text-xs text-blue-600">
          We saved your components from the {toolLabel} - click to add them to your workspace.
        </p>
      </div>
      <a
        href={`/api/app/restore-calc-draft?draft=${encodeURIComponent(draftId)}&dest=components`}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 md:px-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        <span className="hidden sm:inline">Add to my components</span>
        <span className="sm:hidden">Add</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        title="Dismiss - you can rebuild these components anytime"
        className="flex-shrink-0 rounded-full p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
