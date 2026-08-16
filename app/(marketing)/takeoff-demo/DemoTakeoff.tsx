'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  DEMO_QUOTE,
  DEMO_PLAN_URL,
  DEMO_COMPONENTS,
  DEMO_COLLECTIONS,
  DEMO_AI_POINTS,
} from './demo-data/baseline';
import type { DemoFinishPayload } from './DemoWorkstation';
import { DemoQuoteView } from './DemoQuoteView';

// Fabric.js + the full workstation load ONLY when the user enters the demo.
const DemoWorkstation = dynamic(
  () => import('./DemoWorkstation').then(mod => ({ default: mod.DemoWorkstation })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading canvas...</div>
      </div>
    ),
  },
);

type DemoStage =
  | { phase: 'landing' }
  | { phase: 'takeoff'; mode: 'scan' | 'manual'; run: number }
  | { phase: 'quote'; payload: DemoFinishPayload; run: number };

export function DemoTakeoff() {
  const [stage, setStage] = useState<DemoStage>({ phase: 'landing' });
  const [run, setRun] = useState(0);

  const enter = useCallback((mode: 'scan' | 'manual') => {
    setRun(r => r + 1);
    setStage({ phase: 'takeoff', mode, run: run + 1 });
  }, [run]);

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  if (stage.phase === 'quote') {
    return <DemoQuoteView payload={stage.payload} onRestart={restart} />;
  }

  if (stage.phase === 'takeoff') {
    return (
      <DemoWorkstation
        key={stage.run}
        workspaceSlug="demo"
        quote={DEMO_QUOTE as never}
        planUrl={DEMO_PLAN_URL}
        components={DEMO_COMPONENTS}
        collections={DEMO_COLLECTIONS}
        hydrationData={null}
        aiTakeoffAvailable
        aiAssistPoints={DEMO_AI_POINTS}
        demoMode={stage.mode}
        onFinish={payload => setStage({ phase: 'quote', payload, run: stage.run })}
      />
    );
  }

  // Landing panel - same visual language as the marketing site.
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Interactive demo</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Try the digital takeoff</h1>
        <p className="mt-2 text-sm text-slate-500">
          The full QuoteCore+ takeoff workstation with a sample roof plan. Scan it with AI or measure
          it yourself, then see the customer quote your measurements produce. No sign-in, nothing
          is saved.
        </p>

        <div className="mt-8 grid gap-3">
          <button
            onClick={() => enter('scan')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            Scan plan with AI
          </button>
          <button
            onClick={() => enter('manual')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.042 21.672 13.684 16.6m0 0-2.51 2.51.568-3.968m2.942-4.571a3 3 0 0 0-4.243-4.243M3 3v18h18M16.5 8.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
            </svg>
            Measure manually
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Sample plan and AI scan captured from a real QuoteCore+ takeoff session.
          Roof pitch fixed at 25 degrees. Best experienced on a desktop.
        </p>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            <svg className="w-4 h-4 inline -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg> Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}
