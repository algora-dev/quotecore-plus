'use client';

import { useEffect, useMemo, useState } from 'react';
import { FreeTakeoffApp, type FreeTakeoffSeed } from '@/app/(public)/free-roof-takeoff/FreeTakeoffApp';
import {
  ROOFING_TAKEOFF_CONFIG,
  CLADDING_TAKEOFF_CONFIG,
  FLOORING_TAKEOFF_CONFIG,
} from '@/app/(public)/free-roof-takeoff/tradeConfig';
import type { AiScanData } from '@/app/lib/takeoff/applyAiResults';

type SessionPayload = {
  trade: 'roofing' | 'cladding' | 'flooring';
  unitSystem: 'metric' | 'imperial' | 'squares';
  asset: { kind: 'image' | 'pdf'; mimeType: 'image/png' | 'image/jpeg' | 'application/pdf'; fileName: string; byteLength: number };
  outlineSuggestion: AiScanData | null;
};

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; payload: SessionPayload; planUrl: string };

function readSessionReference(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('session');
}

export function PluginTakeoffWorkspace() {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    const session = readSessionReference();
    if (!session) { setState({ status: 'error', message: 'This takeoff link is missing its temporary session reference.' }); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/mcp/free-tools/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session }), cache: 'no-store',
        });
        const payload = await response.json() as SessionPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Could not load this temporary takeoff session.');
        const assetResponse = await fetch('/api/mcp/free-tools/asset', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session }), cache: 'no-store',
        });
        if (!assetResponse.ok) {
          const problem = await assetResponse.json().catch(() => ({})) as { error?: string };
          throw new Error(problem.error || 'Could not load the temporary plan asset.');
        }
        const blob = await assetResponse.blob();
        const planUrl = URL.createObjectURL(blob);
        if (cancelled) { URL.revokeObjectURL(planUrl); return; }
        setState({ status: 'ready', payload, planUrl });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : 'Could not load this takeoff session.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const url = state.planUrl;
    return () => URL.revokeObjectURL(url);
  }, [state]);

  const config = useMemo(() => {
    if (state.status !== 'ready') return ROOFING_TAKEOFF_CONFIG;
    if (state.payload.trade === 'cladding') return CLADDING_TAKEOFF_CONFIG;
    if (state.payload.trade === 'flooring') return FLOORING_TAKEOFF_CONFIG;
    // The public free roofing tool intentionally keeps live AI disabled. The
    // MCP workspace is a separate host surface: it may arrive with a model
    // outline proposal and explicitly offers the existing reviewed scan2/3
    // component workflow after the human has corrected/saved that outline.
    return { ...ROOFING_TAKEOFF_CONFIG, aiScan: true };
  }, [state]);

  if (state.status === 'loading') return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><p>Loading your QuoteCore+ takeoff...</p></main>;
  if (state.status === 'error') return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><div className="max-w-lg text-center"><h1 className="text-2xl font-semibold">Takeoff session unavailable</h1><p className="mt-3 text-slate-300">{state.message}</p><a className="mt-6 inline-block underline" href="/free-tools">Open QuoteCore+ Free Tools</a></div></main>;

  const seed: FreeTakeoffSeed = {
    planUrl: state.planUrl,
    planFileName: state.payload.asset.fileName,
    planMimeType: state.payload.asset.mimeType,
    unitSystem: state.payload.unitSystem,
    ...(state.payload.outlineSuggestion
      ? { outlineSuggestion: { data: state.payload.outlineSuggestion, autoPresent: true } }
      : {}),
  };
  return <FreeTakeoffApp config={config} seed={seed} onExit={() => { window.location.href = '/free-tools'; }} />;
}
