'use client';

import { useEffect, useState } from 'react';

/**
 * "Where is my takeoff?" helper banner (green - deliberately distinct from
 * the blue component-import banner). Shown after a free-roof-takeoff draft
 * import (qcp_takeoff_note cookie, set by import-takeoff-draft) until the
 * user clicks OK. Points them at Quotes -> Drafts to find the quote that
 * was created from their takeoff.
 */
export function TakeoffDraftNoteBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/qcp_takeoff_note=1/);
    if (match) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    document.cookie = 'qcp_takeoff_note=; path=/; max-age=0';
    const h = window.location.hostname.toLowerCase();
    if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
      document.cookie = 'qcp_takeoff_note=; path=/; max-age=0; domain=.quote-core.com';
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-3 md:px-4 rounded-xl border border-green-200 bg-green-50">
      <div className="flex-shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-green-800">
          Your free roof takeoff is saved as a draft quote
        </p>
        <p className="text-xs text-green-700">
          To open it: go to <span className="font-semibold">Quotes</span> and click the <span className="font-semibold">Drafts</span> tab - your takeoff will be sitting there with its roof areas and measurements.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 rounded-full border border-green-300 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 transition min-h-[44px]"
      >
        OK
      </button>
    </div>
  );
}
