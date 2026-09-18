'use client';

import { useEffect, useState } from 'react';
import { ChatClient } from '@/app/(auth)/[workspaceSlug]/assistant/ChatClient';
import type { ConversationRow } from '@/app/(auth)/[workspaceSlug]/assistant/actions';

type Props = {
  workspaceSlug: string;
  initialConversations: ConversationRow[];
  assistantName: string;
  greeting: string;
};

/**
 * Smart Assistant launcher (V1.5). Replaces the legacy Q widget for
 * flag-on companies: a bottom-right FAB that opens a chat panel with the
 * same Apex-style interaction model, in QuoteCore+ styling. Mobile gets a
 * full-screen sheet; desktop gets a floating panel. The standalone page at
 * /[ws]/assistant keeps working (same ChatClient).
 */
export function SmartAssistantLauncher({ workspaceSlug, initialConversations, assistantName, greeting }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const settingsHref = `/${workspaceSlug}/account/smart-assistant`;

  return (
    <>
      {!open && (
        <button
          aria-label={`Open ${assistantName}`}
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full bg-black py-2.5 pl-3 pr-4 text-left text-white shadow-xl transition hover:-translate-y-px hover:shadow-2xl sm:bottom-5 sm:right-5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6B35]/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-bold leading-tight">{assistantName}</span>
            <span className="block text-[10px] leading-tight text-white/70">Ask about quotes, pricing and jobs</span>
          </span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={assistantName}
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-white shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(720px,calc(100dvh-2.5rem))] sm:w-[min(420px,calc(100vw-2.5rem))] sm:rounded-2xl sm:border sm:border-slate-200"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 bg-black px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF6B35]/20">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{assistantName}</p>
                <p className="truncate text-[10px] text-white/70">Workspace assistant</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={settingsHref}
                aria-label="Assistant settings"
                title="Assistant settings"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6 1.65 1.65 0 0010 3.09V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.31.4.55.71.66H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </a>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <ChatClient
              initialConversations={initialConversations}
              assistantName={assistantName}
              greeting={greeting}
              settingsHref={settingsHref}
              embedded
            />
          </div>
        </div>
      )}
    </>
  );
}
