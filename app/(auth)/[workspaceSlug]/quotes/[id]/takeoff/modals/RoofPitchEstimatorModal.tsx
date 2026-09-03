'use client';

/**
 * Roof Pitch Estimator modal.
 *
 * Upload a roof image -> optionally level it (2 clicks on a known-horizontal
 * feature) -> choose single/two plane -> click eave/ridge points -> get an
 * estimated pitch to apply back to the area pitch field.
 *
 * Remote estimating aid only - accuracy depends entirely on the user's image
 * and point placement. No fixed accuracy claims in the UI (per build brief).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Pt,
  levelAngleRad,
  radToDeg,
  singlePlanePitch,
  twoPlanePitch,
  closestCommonPitch,
} from '@/app/lib/roof-pitch-estimator';

type Step = 'intro' | 'level' | 'mode' | 'measure' | 'result';
type Mode = 'single' | 'two';

const MAX_CANVAS_W = 560;

export function RoofPitchEstimatorModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  /** Called with the estimated pitch in degrees when the user accepts it. */
  onApply?: (degrees: number) => void;
}) {
  const [step, setStep] = useState<Step>('intro');
  const [mode, setMode] = useState<Mode>('two');

  // Original uploaded bitmap + the (possibly rotated) working copy.
  const originalRef = useRef<HTMLImageElement | null>(null);
  const [workingUrl, setWorkingUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // Level step: 2 clicks on something that should be horizontal.
  const [levelPts, setLevelPts] = useState<Pt[]>([]);

  // Measure step points.
  const [pts, setPts] = useState<Pt[]>([]);
  const [result, setResult] = useState<null | {
    avgDeg: number;
    leftDeg?: number;
    rightDeg?: number;
    diffDeg?: number;
    consistent?: boolean;
  }>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ---------- image loading ----------
  const onFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      originalRef.current = img;
      setWorkingUrl(url);
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setLevelPts([]);
      setPts([]);
      setResult(null);
      setStep('level');
    };
    img.src = url;
  }, []);

  // ---------- canvas rendering ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !workingUrl || !imgSize) return;
    const scale = Math.min(1, MAX_CANVAS_W / imgSize.w);
    const w = imgSize.w * scale;
    const h = imgSize.h * scale;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      const all = step === 'level' ? levelPts : pts;
      all.forEach((p, i) => {
        // point marker
        ctx.fillStyle = '#FF6B35';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x * scale, p.y * scale, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // connection line
        if (i > 0) {
          const prev = all[i - 1];
          ctx.strokeStyle = '#FF6B35';
          ctx.lineWidth = 2;
          ctx.setLineDash(step === 'level' ? [] : [6, 4]);
          ctx.beginPath();
          ctx.moveTo(prev.x * scale, prev.y * scale);
          ctx.lineTo(p.x * scale, p.y * scale);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    };
    img.src = workingUrl;
  }, [workingUrl, imgSize, levelPts, pts, step]);

  useEffect(() => { draw(); }, [draw]);

  function canvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!imgSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p: Pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (step === 'level') {
      if (levelPts.length < 2) setLevelPts(prev => [...prev, p]);
    } else if (step === 'measure') {
      const max = mode === 'two' ? 3 : 2;
      if (pts.length < max) setPts(prev => [...prev, p]);
    }
  }

  // ---------- levelling ----------
  function applyLevel() {
    if (levelPts.length !== 2 || !originalRef.current) return;
    const src = originalRef.current;
    const angle = levelAngleRad(levelPts[0], levelPts[1]);
    const deg = radToDeg(angle);
    if (Math.abs(deg) < 0.2) { setStep('mode'); return; }
    const w = src.naturalWidth;
    const h = src.naturalHeight;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const nw = Math.ceil(w * cos + h * sin);
    const nh = Math.ceil(w * sin + h * cos);
    const off = document.createElement('canvas');
    off.width = nw; off.height = nh;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(-angle);
    ctx.drawImage(src, -w / 2, -h / 2);
    off.toBlob(blob => {
      if (blob) {
        setWorkingUrl(URL.createObjectURL(blob));
        setImgSize({ w: nw, h: nh });
        setLevelPts([]);
        setStep('mode');
      }
    }, 'image/png');
  }

  // ---------- measurement ----------
  useEffect(() => {
    if (step !== 'measure' || !imgSize) return;
    const max = mode === 'two' ? 3 : 2;
    if (pts.length < max) return;
    if (mode === 'single') {
      const deg = singlePlanePitch(pts[0], pts[1]);
      setResult({ avgDeg: deg });
    } else {
      const r = twoPlanePitch(pts[0], pts[1], pts[2]);
      setResult({
        avgDeg: r.consistent ? r.avgDeg : Math.max(r.leftDeg, r.rightDeg),
        leftDeg: r.leftDeg, rightDeg: r.rightDeg, diffDeg: r.diffDeg, consistent: r.consistent,
      });
    }
    setStep('result');
  }, [pts, step, mode, imgSize]);

  function resetMeasure() {
    setPts([]); setResult(null); setStep('measure');
  }

  const tipFor = (i: number) => {
    if (step === 'level') {
      return i === 0
        ? 'Click one end of something that should be horizontal (eave, gutter, fascia).'
        : 'Click the other end of that same horizontal line.';
    }
    if (mode === 'single') {
      return i === 0
        ? 'Click the lowest visible point of this roof plane (eave, gutter or fascia).'
        : 'Click the highest visible point of the same roof plane (ridge / high point).';
    }
    return ['Click the LEFT eave (where the roof surface meets the eave, gutter or fascia).',
      'Click the RIDGE - the centre of the ridge or highest point between the two planes.',
      'Click the RIGHT eave (where the opposite roof surface meets the eave).'][i] ?? '';
  };

  const heading = 'Estimate Roof Pitch From an Image';
  const btn = 'rounded-full px-4 py-2 text-sm font-semibold transition';

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Upload a clear image of the roof (Google Earth 3D, Street View, customer photo, drone shot)
                and QuoteCore will estimate the pitch from the visible roof geometry.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">Best results when the camera is:</p>
                <p>- as square-on to the roof as possible (not heavily off to one side)</p>
                <p>- roughly level with the roof, between eave and ridge height</p>
                <p>- centred on the target roof area</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => fileRef.current?.click()} className={`${btn} bg-black text-white hover:bg-slate-800`}>Upload Image</button>
                <button onClick={() => setStep('level')} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Image Tips</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            </div>
          )}

          {workingUrl && (step === 'level' || step === 'measure') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-800">
                  {step === 'level' ? 'Level Image (optional)' : mode === 'two' ? 'Two Roof Planes - click the points' : 'Single Roof Plane - click the points'}
                </div>
                <div className="text-xs text-slate-500">{tipFor(step === 'level' ? levelPts.length : pts.length)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex justify-center">
                <canvas ref={canvasRef} onClick={canvasClick} className="max-w-full cursor-crosshair" />
              </div>
              {step === 'level' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={applyLevel} disabled={levelPts.length !== 2}
                    className={`${btn} bg-black text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed`}>
                    Level Image
                  </button>
                  <button onClick={() => { setLevelPts([]); }} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Reset</button>
                  <button onClick={() => { setLevelPts([]); setStep('mode'); }} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Skip - Image Already Level</button>
                </div>
              )}
              {step === 'measure' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={resetMeasure} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Clear Points</button>
                  <button onClick={() => setStep('mode')} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Change Mode</button>
                </div>
              )}
            </div>
          )}

          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">How much of the roof can you see clearly?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => { setMode('two'); setPts([]); setStep('measure'); }}
                  className="text-left rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 p-4 transition">
                  <div className="font-medium text-sm text-slate-900">Two roof planes</div>
                  <pre className="text-[10px] text-slate-400 mt-2 leading-tight">{'   RIDGE\n    *\n   / \\\n  /   \\\n *-----*\nL eave  R eave'}</pre>
                  <p className="text-xs text-slate-600 mt-2">Both sides visible and they look like the same pitch (gable / regular hip ends). 3 clicks.</p>
                </button>
                <button onClick={() => { setMode('single'); setPts([]); setStep('measure'); }}
                  className="text-left rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 p-4 transition">
                  <div className="font-medium text-sm text-slate-900">Single roof plane</div>
                  <pre className="text-[10px] text-slate-400 mt-2 leading-tight">{'HIGH POINT\n    *\n   /\n  /\n *\n EAVE'}</pre>
                  <p className="text-xs text-slate-600 mt-2">Only one plane visible, different pitches, or mono-pitch / skillion. 2 clicks.</p>
                </button>
              </div>
              <button onClick={() => setStep('level')} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Back to levelling</button>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 px-6 py-5 text-center">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Estimated roof pitch</div>
                <div className="text-5xl font-bold text-slate-900 mt-2">{result.avgDeg.toFixed(1)}&deg;</div>
                <div className="text-sm text-slate-600 mt-2">
                  Closest common pitch: approximately {closestCommonPitch(result.avgDeg).deg}&deg; ({closestCommonPitch(result.avgDeg).ratio})
                </div>
                {result.leftDeg != null && (
                  <div className="text-xs text-slate-500 mt-3">
                    Left side {result.leftDeg.toFixed(1)}&deg; / Right side {result.rightDeg!.toFixed(1)}&deg;
                    {result.consistent
                      ? <span className="ml-2 text-green-700 font-medium">Good consistency</span>
                      : <span className="ml-2 text-amber-700 font-medium">Sides differ - check the image or roof geometry, or measure each side separately</span>}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <span className="font-semibold">Estimated pitch only.</span> Calculated from the geometry visible in
                your image - perspective distortion, camera position, image quality and point placement all affect
                the result. Use as a remote estimating aid, not a surveyed measurement. Verify before ordering materials.
              </div>
              <div className="flex flex-wrap gap-2">
                {onApply && (
                  <button onClick={() => onApply(result.avgDeg)}
                    className={`${btn} bg-black text-white hover:bg-slate-800`}>Use This Pitch</button>
                )}
                <button onClick={resetMeasure} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Edit Points</button>
                <button onClick={() => { setPts([]); setResult(null); setStep('mode'); }} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Measure Another Plane</button>
                <button onClick={() => { setWorkingUrl(null); setImgSize(null); setResult(null); setStep('intro'); }} className={`${btn} border border-slate-300 text-slate-600 hover:border-slate-400`}>Try Another Image</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
