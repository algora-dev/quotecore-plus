'use client';

import { useState } from 'react';

/**
 * Sequential "Download all" for the public attachments card (v1 - NOT a zip).
 * Each href points at the gated download route, which 302-redirects to a
 * short-lived signed URL. We trigger them one at a time with a small gap so
 * browsers don't collapse rapid same-tab navigations into a single download.
 */
export function DownloadAllAttachments({ hrefs }: { hrefs: string[] }) {
  const [busy, setBusy] = useState(false);

  async function handleDownloadAll() {
    if (busy || hrefs.length === 0) return;
    setBusy(true);
    try {
      for (const href of hrefs) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = href;
        document.body.appendChild(iframe);
        // Stagger so each gated redirect resolves before the next fires, and
        // clean the iframe up after it has had time to start the download.
        await new Promise((resolve) => setTimeout(resolve, 800));
        setTimeout(() => {
          iframe.remove();
        }, 5000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownloadAll}
      disabled={busy}
      className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      {busy ? 'Downloading…' : 'Download all'}
    </button>
  );
}
