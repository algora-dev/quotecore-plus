'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DEMO_SCAN,
  DEMO_CALIBRATION,
  DEMO_PLAN_URL,
  DEMO_COMPONENTS,
  DEMO_COLLECTIONS,
  DEMO_AI_POINTS,
  type DemoFinishPayload,
} from './demo-data/baseline';
import {
  FreeTakeoffApp,
  prewarmTakeoffWorkstation,
  type FreeTakeoffSeed,
} from '@/app/(public)/free-roof-takeoff/FreeTakeoffApp';
import { ROOFING_TAKEOFF_CONFIG } from '@/app/(public)/free-roof-takeoff/tradeConfig';
import { DemoQuoteView } from './DemoQuoteView';
import { trackEvent } from '@/lib/analytics';
import { trackFreeToolEvent } from '@/app/(public)/lib/trackFreeToolEvent';

type DemoStage =
  | { phase: 'landing' }
  | { phase: 'takeoff'; mode: 'scan' | 'manual'; run: number; startedAt: number }
  | { phase: 'quote'; payload: DemoFinishPayload; run: number; startedAt: number };

/**
 * Interactive demo wrapper on the free-tool shell (FreeTakeoffApp).
 *
 * The takeoff stage renders the REAL app workstation, seeded with the
 * captured baseline (plan + calibration + component library +, in scan mode,
 * the captured AI scan replay). Visitors are measuring in ~5 seconds:
 * click -> plan loads -> pretend scan applies -> play. The quote stage keeps
 * the original demo conversion funnel (DemoQuoteView) untouched.
 */
export function DemoTakeoff() {
  const [stage, setStage] = useState<DemoStage>({ phase: 'landing' });
  const [run, setRun] = useState(0);
  const deepLinked = useRef(false);

  const enter = useCallback((mode: 'scan' | 'manual') => {
    trackEvent('demo_start', { mode });
    trackEvent(mode === 'scan' ? 'demo_scan_used' : 'demo_measure_used');
    trackFreeToolEvent('start', undefined, mode === 'scan' ? 'demo-takeoff-ai' : 'demo-takeoff-manual');
    setSeedMode(mode);
    setRun(r => r + 1);
    setStage({ phase: 'takeoff', mode, run: run + 1, startedAt: Date.now() });
  }, [run]);

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  // Warm the (large) workstation chunk while the visitor reads the landing
  // panel, so the takeoff canvas is ready the moment they click.
  useEffect(() => {
    prewarmTakeoffWorkstation();
  }, []);

  // Deep-link support: /takeoff-demo?mode=ai|manual opens the demo at that stage.
  useEffect(() => {
    if (!deepLinked.current) {
      deepLinked.current = true;
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'ai' || mode === 'scan') enter('scan');
      else if (mode === 'manual') enter('manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback((payload: DemoFinishPayload, mode: 'scan' | 'manual') => {
    trackEvent('demo_quote_viewed', { mode });
    trackFreeToolEvent('output', undefined, mode === 'scan' ? 'demo-takeoff-ai' : 'demo-takeoff-manual');
    setStage(s => ({ phase: 'quote', payload, run: s.phase === 'takeoff' ? s.run : 0, startedAt: s.phase === 'takeoff' ? s.startedAt : Date.now() }));
  }, []);

  // The seed object must stay referentially stable for the shell's one-shot
  // bootstrap, so it is memoised on the mode it was entered with.
  const [seedMode, setSeedMode] = useState<'scan' | 'manual'>('scan');
  const seed = useMemo<FreeTakeoffSeed>(() => ({
    planUrl: DEMO_PLAN_URL,
    unitSystem: 'metric',
    components: DEMO_COMPONENTS,
    collections: DEMO_COLLECTIONS,
    calibration: DEMO_CALIBRATION,
    aiAssistPoints: DEMO_AI_POINTS,
    // Scan mode replays the CAPTURED scan (no /api/free-tools/ai-scan call):
    // the pretend scan applies automatically, then the user plays.
    autoScan: seedMode === 'scan' ? { data: DEMO_SCAN, pitch: 25 } : undefined,
  }), [seedMode]);

  // The demo keeps the roofing config (roof terminology + pitch flow) but
  // points internal back-links at the demo itself instead of the roof tool.
  // Demo keeps the AI surfaces enabled: its scan is a captured replay (no
  // real API calls) and the seeded flow depends on aiScan (see tradeConfig).
  const demoConfig = useMemo(() => ({ ...ROOFING_TAKEOFF_CONFIG, slug: 'takeoff-demo', aiScan: true }), []);

  if (stage.phase === 'quote') {
    return <DemoQuoteView payload={stage.payload} elapsedMs={Date.now() - stage.startedAt} onRestart={restart} />;
  }

  if (stage.phase === 'takeoff') {
    return (
      <FreeTakeoffApp
        key={stage.run}
        seed={seed}
        config={demoConfig}
        onFinish={payload => finish(payload, stage.mode)}
        onExit={restart}
      />
    );
  }

  // Landing panel - same visual language as the marketing site.
  return (
    <div className="flex items-center justify-center px-4 py-10 md:py-14">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Interactive demo</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Try the digital takeoff</h2>
        <p className="mt-2 text-sm text-slate-500">
          The full QuoteCore+ takeoff workstation with a sample roof plan. Scan it with AI or measure
          it yourself, then see the customer quote your measurements produce. No sign-in, nothing
          is saved. Works on desktop, tablet and mobile.
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
          Roof pitch fixed at 25 degrees. Touch input is supported - the same
          precision tools the app uses.
        </p>
      </div>
    </div>
  );
}
