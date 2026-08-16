'use client';

import { useMemo, useState } from 'react';
import DemoCanvas, { type DemoObject } from './DemoCanvas';
import DemoQuoteView from './DemoQuoteView';
import scanData from './demo-data/scan.json';
import { applyAiResults, type AiScanData } from '@/app/lib/takeoff/applyAiResults';
import { DEMO_CANVAS, DEMO_PITCH_FACTOR, DEMO_SCALE_METRES_PER_PIXEL } from './demo-data/setup';
import { trackEvent } from '@/lib/analytics';

type Stage = 'landing' | 'scanning' | 'results' | 'canvas' | 'quote';

function replayScan(): DemoObject[] {
  const calibration = [{ id: 'demo-calibration', point1: { x: 0, y: 0 }, point2: { x: 20, y: 0 }, pixelDistance: 20, actualDistance: 1, unit: 'meters' as const, scale: DEMO_SCALE_METRES_PER_PIXEL }];
  const result = applyAiResults({ aiData: scanData as AiScanData, calibrations: calibration, systemComponentIds: { ridges: 'ridge', hips: 'hip', valleys: 'valley', broken_hips: 'broken-hip', barges: 'barge', spouting: 'spouting', uncertain: 'uncertain' }, canvasWidth: DEMO_CANVAS.width, canvasHeight: DEMO_CANVAS.height });
  return [...result.roofAreas.map((area) => ({ id: area.id, kind: 'area' as const, semanticKey: 'area' as const, points: area.canvasPoints, value: area.area * DEMO_PITCH_FACTOR })), ...result.measurements.map((item) => ({ id: item.id, kind: 'line' as const, semanticKey: item.semanticKey, points: item.canvasPoints, value: item.value * DEMO_PITCH_FACTOR }))];
}

export default function DemoTakeoff() {
  const [stage, setStage] = useState<Stage>('landing');
  const [mode, setMode] = useState<'scan' | 'manual' | null>(null);
  const [scanObjects, setScanObjects] = useState<DemoObject[]>([]);
  const [finishedObjects, setFinishedObjects] = useState<DemoObject[]>([]);
  const [canvasKey, setCanvasKey] = useState(0);
  const counts = useMemo(() => scanObjects.reduce((map, item) => { map[item.semanticKey] = (map[item.semanticKey] ?? 0) + 1; return map; }, {} as Record<string, number>), [scanObjects]);

  const start = (selectedMode: 'scan' | 'manual') => {
    trackEvent('demo_started', { mode: selectedMode });
    setMode(selectedMode);
    if (selectedMode === 'manual') { setCanvasKey((key) => key + 1); setStage('canvas'); return; }
    setStage('scanning');
    window.setTimeout(() => { const objects = replayScan(); setScanObjects(objects); trackEvent('scan_replayed'); setStage('results'); }, 2100);
  };
  const restart = () => { setStage('landing'); setMode(null); setScanObjects([]); setFinishedObjects([]); setCanvasKey((key) => key + 1); };

  if (stage === 'quote') return <DemoQuoteView objects={finishedObjects} onRestart={restart} />;
  if (stage === 'canvas') return <DemoCanvas key={canvasKey} initialObjects={mode === 'scan' ? scanObjects : []} onFinish={(objects) => { trackEvent('finish_clicked', { object_count: objects.length }); setFinishedObjects(objects); setStage('quote'); }} />;
  return <main className="min-h-screen bg-slate-950 text-white"><div className="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-12 md:px-10"><div className="grid w-full gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><div><div className="flex items-center gap-2 text-lg font-semibold"> <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-950">Q</span> QuoteCore<span className="text-[#FF6B35]">+</span></div><p className="mt-12 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">Digital roof takeoff · interactive demo</p><h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Turn a roof plan into a quote in minutes.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Try the same kind of digital measurement workflow roofing teams use to trace areas, measure components and build a professional customer quote.</p><p className="mt-5 text-sm text-slate-400">No account · no upload · no data saved · best experienced on desktop</p></div><div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl md:p-8">{stage === 'scanning' ? <div className="py-12 text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-[#FF6B35]" /><h2 className="mt-6 text-xl font-semibold">Scanning the sample plan…</h2><p className="mt-2 text-sm text-slate-500">Identifying roof areas and components</p><div className="mx-auto mt-7 h-2 max-w-xs overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#FF6B35]" /></div></div> : stage === 'results' ? <div><p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">Scan complete</p><h2 className="mt-2 text-2xl font-semibold">AI found your takeoff</h2><p className="mt-2 text-sm leading-6 text-slate-500">Review the detected items, then apply them to the editable demo canvas.</p><div className="mt-6 grid grid-cols-2 gap-3">{[['Roof areas', counts.area ?? 0], ['Total lines', scanObjects.filter((item) => item.kind === 'line').length], ['Ridges', counts.ridges ?? 0], ['Hips', counts.hips ?? 0], ['Valleys', counts.valleys ?? 0], ['Spouting', counts.spouting ?? 0]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div><button type="button" onClick={() => { setCanvasKey((key) => key + 1); setStage('canvas'); }} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]">Apply to canvas →</button><button type="button" onClick={restart} className="mt-3 w-full rounded-full px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-50">Start over</button></div> : <div><p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B35]">Start in one click</p><h2 className="mt-2 text-2xl font-semibold">Choose your demo</h2><p className="mt-2 text-sm leading-6 text-slate-500">Both options open the same editable canvas and fixed sample roof plan.</p><div className="mt-6 space-y-3"><button type="button" onClick={() => start('scan')} className="group block w-full rounded-xl border-2 border-slate-200 p-5 text-left transition-all hover:border-[#FF6B35] hover:shadow-lg"><span className="flex items-center justify-between"><span className="font-semibold">Scan plan</span><span className="text-[#FF6B35] transition group-hover:translate-x-1">→</span></span><span className="mt-1 block text-sm text-slate-500">See a canned AI scan applied to the plan, then edit it.</span></button><button type="button" onClick={() => start('manual')} className="group block w-full rounded-xl border-2 border-slate-200 p-5 text-left transition-all hover:border-[#FF6B35] hover:shadow-lg"><span className="flex items-center justify-between"><span className="font-semibold">Measure manually</span><span className="text-[#FF6B35] transition group-hover:translate-x-1">→</span></span><span className="mt-1 block text-sm text-slate-500">Start with a blank takeoff and draw it yourself.</span></button></div><p className="mt-6 text-center text-xs text-slate-400">The plan is synthetic and the pricing is sample data.</p></div>}</div></div></div></main>;
}
