'use client';

import { useState, useEffect } from 'react';
import type { AnnouncementConfig } from '@/app/admin/(dashboard)/settings/actions';

const STORAGE_KEY = 'qcp_announcement_dismissed';

export function GlobalAnnouncementBanner({ config }: { config: AnnouncementConfig }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!config.dismissible) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Dismiss if the message hash matches
        if (parsed.message === config.message && parsed.type === config.type) {
          setDismissed(true);
        }
      }
    } catch {
      // ignore
    }
  }, [config.message, config.type, config.dismissible]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        message: config.message,
        type: config.type,
        dismissedAt: new Date().toISOString(),
      }));
    } catch {
      // ignore
    }
  }

  if (dismissed) return null;

  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    maintenance: 'bg-red-50 border-red-200 text-red-800',
  };

  const icon = {
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    maintenance: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  };

  return (
    <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 ${styles[config.type]}`}>
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon[config.type]} />
        </svg>
        <span>{config.message}</span>
      </div>
      {config.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition"
          aria-label="Dismiss announcement"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
