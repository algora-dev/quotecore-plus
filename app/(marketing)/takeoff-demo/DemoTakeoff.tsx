'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  DEMO_QUOTE,
  DEMO_PLAN_URL,
  DEMO_COMPONENTS,
  DEMO_COLLECTIONS,
  DEMO_AI_POINTS,
} from './demo-data/baseline';
import type { DemoFinishPayload } from './DemoWorkstation';
import { DemoQuoteView } from './DemoQuoteView';
import { trackEvent } from '@/lib/analytics';

type DemoDevice = 'desktop' | 'tablet' | 'mobile';

/** DEMO device detection - best effort via UA + screen metrics.
 *  Mobile = phones only. Tablets are detected separately so we can warn
 *  (works, but not optimized) instead of block. */
function detectDemoDevice(): DemoDevice {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isTabletUA = isIpad || /Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua);
  if (isTabletUA) return 'tablet';
  const isMobileUA = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  if (isMobileUA) return 'mobile';
  // Touch-capable small screens ( Surface/phones in desktop mode )
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 768) return 'mobile';
  return 'desktop';
}

// Fabric.js + the full workstation load ONLY when the user enters the demo.
const DemoWorkstation = dynamic(
  () => import('./DemoWorkstation').then(mod => ({ default: mod.DemoWorkstation })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[60vh] bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading canvas...</div>
      </div>
    ),
  },
);

type DemoStage =
  | { phase: 'landing' }
  | { phase: 'takeoff'; mode: 'scan' | 'manual'; run: number; startedAt: number }
  | { phase: 'quote'; payload: DemoFinishPayload; run: number; startedAt: number };

export function DemoTakeoff() {
  const [stage, setStage] = useState<DemoStage>({ phase: 'landing' });
  const [run, setRun] = useState(0);
  const [device, setDevice] = useState<DemoDevice>('desktop');
  const [deviceNoticeOpen, setDeviceNoticeOpen] = useState(false);
  // Mobile never renders the interactive UI - the page-level video fallback
  // section (md:hidden) takes over instead.
  const [suppressMobile, setSuppressMobile] = useState(false);
  const deepLinked = useRef(false);

  const enter = useCallback((mode: 'scan' | 'manual') => {
    trackEvent('demo_start', { mode });
    trackEvent(mode === 'scan' ? 'demo_scan_used' : 'demo_measure_used');
    setRun(r => r + 1);
    setStage({ phase: 'takeoff', mode, run: run + 1, startedAt: Date.now() });
  }, [run]);

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const d = detectDemoDevice();
    setDevice(d);
    if (d === 'mobile') {
      setSuppressMobile(true);
      return;
    }
    if (d === 'tablet') setDeviceNoticeOpen(true);

    // Deep-link support: /takeoff-demo?mode=ai|manual opens the demo at that stage.
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
    setStage(s => ({ phase: 'quote', payload, run: s.phase === 'takeoff' ? s.run : 0, startedAt: s.phase === 'takeoff' ? s.startedAt : Date.now() }));
  }, []);

  if (suppressMobile) return null;

  if (stage.phase === 'quote') {
    return <DemoQuoteView payload={stage.payload} elapsedMs={Date.now() - stage.startedAt} onRestart={restart} />;
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
        onFinish={payload => finish(payload, stage.mode)}
      />
    );
  }

  // Landing panel - same visual language as the marketing site.
  return (
    <div className="flex items-center justify-center px-4 py-10 md:py-14">
      {/* Device notice - tablet users get one clear warning up front. */}
      {deviceNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-base font-semibold text-slate-900">
                Not optimized for tablets
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You can use this tool on a tablet, but it is not optimized - touch input is less accurate for placing
                points and some things may be buggy. For the best experience, use a desktop computer.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => setDeviceNoticeOpen(false)}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                >
                  Continue anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Interactive demo</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Try the digital takeoff</h2>
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
          Roof pitch fixed at 25 degrees. Optimized for desktop computers - tablets
          work but are not optimized.
        </p>

        {device === 'tablet' && (
          <p className="mt-3 text-xs font-medium text-[#BD4A1A]">
            You are on a tablet - this tool works but is not optimized. A desktop gives the most accurate results.
          </p>
        )}
      </div>
    </div>
  );
}
