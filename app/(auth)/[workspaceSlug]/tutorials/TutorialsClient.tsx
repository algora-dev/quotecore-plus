'use client';

import { useState } from 'react';
import { TUTORIALS, type Tutorial } from './tutorials.data';
import { TutorialModal } from './TutorialModal';

interface Props {
  /** Workspace base path, e.g. "/acme". */
  base: string;
  /** Whether the Q assistant is on (gates the "Walk me through with Q" CTA). */
  assistantEnabled: boolean;
}

/**
 * Tutorials hub — Resource-Library-style card grid. Each card is a button that
 * opens TutorialModal (NOT a link). Reading every card ≈ understanding the
 * whole app in a few minutes.
 */
export function TutorialsClient({ base, assistantEnabled }: Props) {
  const [active, setActive] = useState<Tutorial | null>(null);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tutorials</h1>
        <p className="mt-1 text-sm text-slate-500">
          New to QuoteCore+? Tap any card for a quick rundown — what it&apos;s for, how it works, and
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
            className="group block rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-[0_0_12px_rgba(255,107,53,0.08)]"
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
    </section>
  );
}
