'use client';

import { useEffect, useState } from 'react';
import { TUTORIALS, type Tutorial } from './tutorials.data';
import { TutorialModal } from './TutorialModal';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
import Link from 'next/link';
import './tutorials.css';

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
    <QcLibrary className="qc-tutorial-library space-y-6">
      <Link className="qc-page-back qc-flow-link" href={`${base}/resources`}>← Back to Resources</Link>
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
            className="qc-tutorial-card"
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
    </QcLibrary>
  );
}

/**
 * First-visit intro modal. Escape and the explicit footer actions close it;
 * backdrop click does not, per the app modal rule.
 */
function TutorialsIntroModal({ onClose }: { onClose: () => void }) {
  return <QcDialog open title="Welcome to Tutorials" description="Learn any feature in a couple of minutes."
    onRequestClose={onClose} className="qc-tutorial-dialog"
    footer={<><QcButton onClick={onClose}>Close</QcButton><QcButton variant="primary" onClick={onClose}>Got it</QcButton></>}>
    <div className="qc-tutorial-content">
      <p><strong>Learn every feature of the app in one place.</strong></p>
      <p>Start with <strong>Quotes</strong> and <strong>Smart Components™</strong>, then move on to <strong>Orders</strong> and <strong>Invoices</strong>, or explore at your own pace.</p>
      <p>Need help? <strong>Q</strong> is your personal assistant and can answer questions anytime.</p>
    </div>
  </QcDialog>;
}
