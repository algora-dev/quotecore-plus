'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { TOOL_COMPONENTS, TOOL_COLLECTIONS, DEMO_AI_POINTS } from '@/app/(marketing)/takeoff-demo/demo-data/baseline';
import type { DemoFinishPayload } from '@/app/(marketing)/takeoff-demo/DemoWorkstation';
import { TakeoffOutputView, type TakeoffOutputExtras } from './TakeoffOutputView';
import type { QuoteRow } from '@/app/lib/types';

// Fabric.js + the full workstation load ONLY when the user enters the tool.
const Workstation = dynamic(
  () => import('@/app/(marketing)/takeoff-demo/DemoWorkstation').then(mod => ({ default: mod.DemoWorkstation })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading canvas...</div>
      </div>
    ),
  },
);

type Stage =
  | { phase: 'landing' }
  | { phase: 'takeoff'; run: number; planDataUrl: string; startedAt: number }
  | { phase: 'output'; payload: DemoFinishPayload; run: number; planDataUrl: string; startedAt: number };

type Device = 'desktop' | 'tablet' | 'mobile';

function detectDevice(): Device {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIpad || /Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
  if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return 'mobile';
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 768) return 'mobile';
  return 'desktop';
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

const TOOL_QUOTE = {
  id: 'tool-quote',
  company_id: 'tool-company',
  customer_name: 'Roof Plan',
  quote_number: 1,
  measurement_system: 'metric',
  trade: 'roofing',
  currency: 'NZD',
} as unknown as QuoteRow;

export function FreeRoofTakeoff() {
  const [stage, setStage] = useState<Stage>({ phase: 'landing' });
  const [device, setDevice] = useState<Device>('desktop');
  const [deviceNoticeOpen, setDeviceNoticeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = detectDevice();
    setDevice(d);
    if (d !== 'desktop') setDeviceNoticeOpen(true);
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('Please upload a PNG, JPG or WebP image of your plan.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image too large - maximum 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setStage(prev => {
        const run = prev.phase === 'landing' ? 1 : (prev.run ?? 0) + 1;
        return { phase: 'takeoff', run, planDataUrl: dataUrl, startedAt: Date.now() };
      });
    };
    reader.onerror = () => setError('Could not read that image. Try a different file.');
    reader.readAsDataURL(file);
  }, []);

  const restart = useCallback(() => {
    setStage({ phase: 'landing' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  if (stage.phase === 'output') {
    const extras: TakeoffOutputExtras = { planDataUrl: stage.planDataUrl, elapsedMs: Date.now() - stage.startedAt };
    return (
      <TakeoffOutputView
        payload={stage.payload}
        extras={extras}
        onRestart={restart}
        onBackToCanvas={() => setStage({ phase: 'takeoff', run: stage.run + 1, planDataUrl: stage.planDataUrl, startedAt: stage.startedAt })}
      />
    );
  }

  if (stage.phase === 'takeoff') {
    return (
      <Workstation
        key={stage.run}
        workspaceSlug="takeoff-tool"
        quote={TOOL_QUOTE}
        planUrl={stage.planDataUrl}
        components={TOOL_COMPONENTS}
        collections={TOOL_COLLECTIONS}
        hydrationData={null}
        aiTakeoffAvailable={false}
        aiAssistPoints={DEMO_AI_POINTS}
        demoMode="upload"
        onFinish={payload => setStage({ phase: 'output', payload, run: stage.run, planDataUrl: stage.planDataUrl, startedAt: stage.startedAt })}
      />
    );
  }

  // Landing: upload your own plan.
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center px-4 py-16">
      {deviceNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-base font-semibold text-slate-900">
                {device === 'mobile' ? 'Not available on mobile' : 'Not optimized for tablets'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {device === 'mobile'
                  ? 'This takeoff tool needs a desktop computer - the precision measuring tools do not work on a phone screen. Open this page on a desktop to use it.'
                  : 'You can use this tool on a tablet, but it is not optimized - touch input is less accurate for placing points. For the best experience, use a desktop computer.'}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => setDeviceNoticeOpen(false)}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
                >
                  {device === 'mobile' ? 'Close' : 'Continue anyway'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-[#BD4A1A]">Free takeoff tool</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Measure your own roof plan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Upload a roof plan, calibrate it against a known dimension, and measure roof areas, ridges,
          hips, valleys, barges and spouting with the same digital takeoff system QuoteCore+ uses.
          You get a clean measurement report - free, no sign-up.
        </p>

        {/* Upload dropzone */}
        <label
          className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <span className="mt-3 text-sm font-medium text-slate-700">Click to upload your plan image</span>
          <span className="mt-1 text-xs text-slate-400">PNG, JPG or WebP - up to 10 MB</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
        {error && <p className="mt-2 text-sm text-[#BD4A1A]">{error}</p>}

        {/* What makes a good plan */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For best results, your plan should be:</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>High quality and clear, with straight, sharp lines</li>
            <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>Square to the page (lines running at 90 degrees)</li>
            <li className="flex gap-2"><span className="text-[#BD4A1A]">&#10003;</span>Showing at least one clear, obvious measurement (e.g. a wall or ridge length) you can use to calibrate the scale</li>
          </ul>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Manual measuring only - no AI scan in this free tool. Nothing is saved unless you choose
          to send the result into the app. Desktop recommended; tablets work but are not optimized.
        </p>

        {device !== 'desktop' && (
          <p className="mt-3 text-xs font-medium text-[#BD4A1A]">
            {device === 'mobile'
              ? 'This tool does not work on mobile. Please open it on a desktop computer.'
              : 'You are on a tablet - this tool works but is not optimized. A desktop gives the most accurate results.'}
          </p>
        )}

        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
          <Link href="/takeoff-demo" className="text-sm text-slate-500 hover:text-slate-800">
            No plan handy? Try the demo with a sample plan
          </Link>
        </div>
      </div>
    </div>
  );
}
