'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Canvas, FabricImage, Line, Polygon } from 'fabric';
import { AI_COMPONENT_REGISTRY, type SemanticKey } from '@/app/lib/takeoff/aiComponentRegistry';
import { computeAreaValue, computeLineValue, type CanvasPoint } from '@/app/lib/takeoff/applyAiResults';
import { DEMO_CANVAS, DEMO_PITCH_FACTOR, DEMO_SCALE_METRES_PER_PIXEL } from './demo-data/setup';

export type DemoObjectKind = 'area' | 'line';
export interface DemoObject {
  id: string;
  kind: DemoObjectKind;
  semanticKey: SemanticKey | 'area';
  points: CanvasPoint[];
  value: number;
}

interface Props {
  initialObjects: DemoObject[];
  onFinish: (objects: DemoObject[]) => void;
}

const LINE_TYPES: SemanticKey[] = ['ridges', 'hips', 'valleys', 'barges', 'spouting'];
const makeId = () => `demo-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export default function DemoCanvas({ initialObjects, onFinish }: Props) {
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);
  const objectsRef = useRef<DemoObject[]>(initialObjects);
  const previousObjects = useRef<DemoObject[] | null>(null);
  const draftPoints = useRef<CanvasPoint[]>([]);
  const [objects, setObjects] = useState(initialObjects);
  const [tool, setTool] = useState<'select' | 'area' | 'line'>('select');
  const [lineType, setLineType] = useState<SemanticKey>('ridges');
  const [draftCount, setDraftCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEmptyMessage, setShowEmptyMessage] = useState(false);

  const updateObjects = useCallback((next: DemoObject[], remember = true) => {
    if (remember) previousObjects.current = objectsRef.current;
    objectsRef.current = next;
    setObjects(next);
  }, []);

  const drawObjects = useCallback((next: DemoObject[]) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    canvas.getObjects().slice().forEach((object) => canvas.remove(object));
    next.forEach((item) => {
      if (item.kind === 'area') {
        const poly = new (requireFabric().Polygon)(item.points, {
          fill: 'rgba(59, 130, 246, 0.18)', stroke: '#2563eb', strokeWidth: 3,
          selectable: true, objectCaching: false,
        }) as Polygon & { demoId?: string };
        poly.demoId = item.id;
        canvas.add(poly);
        return;
      }
      const def = AI_COMPONENT_REGISTRY[item.semanticKey as SemanticKey];
      const line = new (requireFabric().Line)([item.points[0].x, item.points[0].y, item.points[1].x, item.points[1].y], {
        stroke: def.colour, strokeWidth: 5, strokeDashArray: def.dashed ? [12, 8] : undefined,
        selectable: true, hasControls: false, objectCaching: false,
      }) as Line & { demoId?: string };
      line.demoId = item.id;
      canvas.add(line);
    });
    canvas.renderAll();
  }, []);

  useEffect(() => {
    let mounted = true;
    void import('fabric').then(async ({ Canvas, FabricImage }) => {
      if (!mounted || !canvasElement.current) return;
      fabricConstructors = await import('fabric');
      const canvas = new Canvas(canvasElement.current, { width: DEMO_CANVAS.width, height: DEMO_CANVAS.height, selection: true, preserveObjectStacking: true });
      fabricCanvas.current = canvas;
      const image = new Image();
      image.onload = () => {
        if (!mounted) return;
        const background = new FabricImage(image) as FabricImage & { demoBackground?: boolean };
        background.set({ left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false });
        background.demoBackground = true;
        canvas.backgroundImage = background;
        drawObjects(objectsRef.current);
      };
      image.src = '/takeoff-demo/plan.svg';

      const pointer = (event: { e: import('fabric').TPointerEvent }) => canvas.getScenePoint(event.e);
      canvas.on('mouse:down', (event) => {
        if (toolRef.current === 'select' || !event.e) return;
        const point = pointer(event);
        if (point.x < 100 || point.x > 1100 || point.y < 80 || point.y > 680) return;
        if (toolRef.current === 'area') {
          const first = draftPoints.current[0];
          if (first && draftPoints.current.length >= 3 && Math.hypot(point.x - first.x, point.y - first.y) < 24) {
            const points = draftPoints.current;
            const value = computeAreaValue(points, [{ id: 'demo', point1: points[0], point2: points[1], pixelDistance: 1, actualDistance: 1, unit: 'meters', scale: DEMO_SCALE_METRES_PER_PIXEL }]) * DEMO_PITCH_FACTOR;
            updateObjects([...objectsRef.current, { id: makeId(), kind: 'area', semanticKey: 'area', points, value }]);
            draftPoints.current = []; setDraftCount(0); setTool('select'); return;
          }
          draftPoints.current = [...draftPoints.current, { x: point.x, y: point.y }];
          setDraftCount(draftPoints.current.length);
          return;
        }
        const first = draftPoints.current[0];
        if (!first) { draftPoints.current = [{ x: point.x, y: point.y }]; setDraftCount(1); return; }
        const points = [first, { x: point.x, y: point.y }];
        const value = computeLineValue(points[0], points[1], [{ id: 'demo', point1: first, point2: points[1], pixelDistance: 1, actualDistance: 1, unit: 'meters', scale: DEMO_SCALE_METRES_PER_PIXEL }]) * DEMO_PITCH_FACTOR;
        updateObjects([...objectsRef.current, { id: makeId(), kind: 'line', semanticKey: lineTypeRef.current, points, value }]);
        draftPoints.current = []; setDraftCount(0); setTool('select');
      });
      canvas.on('selection:created', (event) => setSelectedId((event.selected?.[0] as { demoId?: string })?.demoId ?? null));
      canvas.on('selection:updated', (event) => setSelectedId((event.selected?.[0] as { demoId?: string })?.demoId ?? null));
      canvas.on('selection:cleared', () => setSelectedId(null));
    });
    return () => { mounted = false; fabricCanvas.current?.dispose(); fabricCanvas.current = null; };
    // The canvas event handlers intentionally capture the current tool from each render only on mount.
    // Tool changes are handled by the ref below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebind the current tool without rebuilding Fabric.
  const toolRef = useRef(tool);
  const lineTypeRef = useRef(lineType);
  toolRef.current = tool; lineTypeRef.current = lineType;

  useEffect(() => { drawObjects(objects); }, [drawObjects, objects]);

  const removeSelected = () => {
    if (!selectedId) return;
    updateObjects(objectsRef.current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };
  const undo = () => {
    if (previousObjects.current === null) return;
    const old = previousObjects.current;
    previousObjects.current = null;
    updateObjects(old, false);
    draftPoints.current = []; setDraftCount(0); setSelectedId(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Delete' || event.key === 'Backspace') removeSelected(); };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  });

  const totals = objects.reduce((acc, item) => { acc[item.semanticKey] = (acc[item.semanticKey] ?? 0) + item.value; return acc; }, {} as Record<string, number>);
  const areaCount = objects.filter((item) => item.kind === 'area').length;
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-slate-950 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col p-3 md:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-white">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Interactive takeoff</p><h1 className="mt-1 text-xl font-semibold">Measure the sample roof plan</h1></div>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300">Fixed calibration · 25° pitch</span>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
          <canvas ref={canvasElement} className="h-auto max-w-full" aria-label="Interactive roof plan canvas" />
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">{tool === 'area' ? `Click roof corners (${draftCount} points) · click the first point to close` : tool === 'line' ? `Click two points to draw a ${AI_COMPONENT_REGISTRY[lineType].displayName.toLowerCase()}` : 'Select an object to delete it, or choose a drawing tool below.'}</p>
      </div>
      <aside className="w-full shrink-0 border-t border-white/10 bg-white p-4 md:p-6 lg:w-[330px] lg:border-l lg:border-t-0">
        <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Demo tools</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Build your takeoff</h2></div><span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">No sign-in</span></div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(['select', 'area', 'line'] as const).map((item) => <button key={item} type="button" onClick={() => { setTool(item); draftPoints.current = []; setDraftCount(0); }} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${tool === item ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'}`}>{item === 'select' ? 'Select' : item === 'area' ? 'Roof area' : 'Line'}</button>)}
        </div>
        {tool === 'line' && <div className="mt-3 flex flex-wrap gap-2">{LINE_TYPES.map((key) => <button key={key} type="button" onClick={() => setLineType(key)} className={`rounded-full border px-2.5 py-1 text-xs transition ${lineType === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-orange-300'}`}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: AI_COMPONENT_REGISTRY[key].colour }} />{AI_COMPONENT_REGISTRY[key].displayName}</button>)}</div>}
        <div className="mt-4 flex gap-2"><button type="button" onClick={undo} disabled={!previousObjects.current} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Undo last</button><button type="button" onClick={removeSelected} disabled={!selectedId} className="rounded-full border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40">Delete selected</button></div>
        <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Live totals</h3><span className="text-xs text-slate-400">{objects.length} objects</span></div><div className="mt-3 space-y-2"><TotalRow label="Roofing area" value={totals.area ?? 0} unit="m²" colour="#2563eb" /><TotalRow label="Areas measured" value={areaCount} unit="" colour="#2563eb" />{LINE_TYPES.map((key) => <TotalRow key={key} label={AI_COMPONENT_REGISTRY[key].displayName} value={totals[key] ?? 0} unit="m" colour={AI_COMPONENT_REGISTRY[key].colour} />)}</div></div>
        <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900"><p className="font-semibold">Tip</p><p className="mt-1 text-orange-800">Draw one roof area first, then add a ridge, hip, valley or spouting line. Everything is calculated from the fixed plan calibration.</p></div>
        {showEmptyMessage && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Measure at least one roof area or component before finishing.</p>}
        <button type="button" onClick={() => { if (objects.length === 0) { setShowEmptyMessage(true); return; } onFinish(objects); }} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30">Finish takeoff <span className="ml-2">→</span></button>
        <p className="mt-3 text-center text-[11px] text-slate-400">Sample demonstration only · no data is saved</p>
      </aside>
    </div>
  );
}

function TotalRow({ label, value, unit, colour }: { label: string; value: number; unit: string; colour: string }) {
  return <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"><span className="flex items-center gap-2 text-xs text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />{label}</span><span className="text-xs font-semibold text-slate-900">{value.toFixed(unit === 'm²' ? 1 : 2)}{unit && <span className="ml-1 font-normal text-slate-400">{unit}</span>}</span></div>;
}

// Fabric's constructors are loaded by the same dynamic import as Canvas. This
// small bridge keeps the render callback independent from app-wide Fabric state.
let fabricConstructors: typeof import('fabric') | null = null;
function requireFabric() { if (!fabricConstructors) throw new Error('Fabric is still loading'); return fabricConstructors; }
