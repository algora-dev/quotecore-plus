'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dismissWelcomeModal } from './welcome-actions';

interface Props {
  /** Workspace base path, e.g. "/acme". */
  base: string;
  /** User's first name for the greeting. */
  firstName: string;
}

/**
 * First-login Welcome modal. Renders once for brand-new users on the dashboard
 * (gated server-side by `users.tutorials_seen_at IS NULL`). Points them at the
 * Tutorials hub, the help docs, and Q — and suggests starting with Tutorials.
 *
 * Dismissing (any path) stamps `tutorials_seen_at` so it never shows again.
 */
export function WelcomeModal({ base, firstName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();

  function dismiss() {
    setOpen(false);
    startTransition(() => {
      void dismissWelcomeModal();
    });
  }

  function goToTutorials() {
    dismiss();
    router.push(`${base}/tutorials`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6">
          <div className="flex-shrink-0 rounded-full bg-orange-50 p-3">
            <svg className="h-6 w-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="welcome-modal-title" className="text-lg font-semibold text-slate-900">
              Welcome to QuoteCore+, {firstName}!
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">Let&apos;s get you up and running fast.</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">
            There are three ways to learn QuoteCore+:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="font-semibold text-[#FF6B35]">1.</span>
              <span>
                <span className="font-semibold">Tutorials</span> — quick cards explaining every feature. The fastest way to
                understand the whole app. <span className="text-slate-500">Start here.</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#FF6B35]">2.</span>
              <span>
                <span className="font-semibold">Help docs</span> — the <span className="font-mono text-xs">?</span> icon
                (top right) opens searchable help for whatever screen you&apos;re on.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#FF6B35]">3.</span>
              <span>
                <span className="font-semibold">Q</span> — your in-app assistant. Ask &quot;how do I…?&quot; and Q answers
                or walks you through it step by step.
              </span>
            </li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={goToTutorials}
            className="rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_12px_rgba(255,107,53,0.45)]"
          >
            Start with Tutorials
          </button>
        </div>
      </div>
    </div>
  );
}
