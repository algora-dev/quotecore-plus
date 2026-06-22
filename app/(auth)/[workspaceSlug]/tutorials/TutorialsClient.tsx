'use client';

import { useEffect, useState } from 'react';
import { TUTORIALS, type Tutorial } from './tutorials.data';
import { TutorialModal } from './TutorialModal';

const INTRO_SEEN_KEY = 'qcp-tutorials-intro-seen';

interface Props {
  /** Workspace base path, e.g. "/acme". */
  base: string;
  /** Whether the Q assistant is on (gates the "Walk me through with Q" CTA). */
  assistantEnabled: boolean;
}

/**
 * Tutorials hub - Resource-Library-style card grid. Each card is a button that
 * opens TutorialModal (NOT a link). Reading every card ≈ understanding the
 * whole app in a few minutes.
 */
export function TutorialsClient({ base, assistantEnabled }: Props) {
  const [active, setActive] = useState<Tutorial | null>(null);
  // First-visit intro modal. Gated per-browser via localStorage so it shows
  // once when the user first lands on the Tutorials page.
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(INTRO_SEEN_KEY) !== 'yes') {
        setShowIntro(true);
      }
    } catch {
      /* localStorage unavailable - skip the intro */
    }
  }, []);

  function dismissIntro() {
    setShowIntro(false);
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, 'yes');
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tutorials</h1>
        <p className="mt-1 text-sm text-slate-500">
          New to QuoteCore+? Tap any card for a quick rundown - what it&apos;s for, how it works, and
          when to use it. Or let Q walk you through it step by step.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TUTORIALS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t)}
            data-assistant-id={`tutorial-card-${t.id}`}
            className="group block rounded-xl border border-slate-200 bg-white p-5 text-left hover:scale-[1.02] transition-all hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-[0_0_12px_rgba(255,107,53,0.08)]"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-full bg-orange-50 p-3 transition-colors group-hover:bg-orange-100">
                {t.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">{t.title}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{t.tagline}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <TutorialModal
        tutorial={active}
        base={base}
        assistantEnabled={assistantEnabled}
        onClose={() => setActive(null)}
      />

      {showIntro ? <TutorialsIntroModal onClose={dismissIntro} /> : null}
    </section>
  );
}

/**
 * First-visit intro modal. Esc + the X close it; overlay-click does NOT (only
 * the X), per the app modal rule.
 */
function TutorialsIntroModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorials-intro-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start gap-3 px-6 pt-6">
          <div className="flex-shrink-0 rounded-full bg-orange-50 p-3">
            <svg className="h-6 w-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="tutorials-intro-title" className="text-lg font-semibold text-slate-900">
              Welcome to Tutorials
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">Learn any feature in a couple of minutes.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm leading-relaxed text-slate-700">
          <p className="font-semibold text-slate-900">Learn every feature of the app in one place.</p>
          <p>
            Start with <span className="font-semibold">Quotes</span> and{' '}
            <span className="font-semibold">Smart Components™</span>, then move on to{' '}
            <span className="font-semibold">Orders</span> and <span className="font-semibold">Invoices</span>, or
            explore at your own pace.
          </p>
          <p>
            Need help? <span className="font-semibold">&quot;Q&quot;</span> is your personal assistant and can answer
            questions anytime.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.45)]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
