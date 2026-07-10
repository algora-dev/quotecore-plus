'use client';

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────
// HipValleyHouseDiagram
//
// 2.5D house-and-roof illustration for the Hip/Valley
// calculator, based on Shaun's hand-drawn reference:
// an L-shaped building (main block + projecting wing)
// with a 90° internal corner.
//
//   - Exactly TWO visible roof planes:
//       left  = main roof front plane
//       right = wing roof plane
//   - VALLEY (dashed orange) = the fold line between the
//     two planes; its lower end lands EXACTLY on the
//     internal wall corner.
//   - HIP (solid orange) = the wing's outer front arris;
//     its lower end lands EXACTLY on the outer front
//     wall corner.
//   - Wall footprint is FIXED. Only the upper roof
//     points move vertically with pitch.
// ─────────────────────────────────────────────────────

interface Point { x: number; y: number; }

export interface HipValleyHouseDiagramProps {
  pitchDegrees: number;
  hipSlopeDegrees: number;
  hipValleyLength: number;
  planLength?: number;
  unit: 'm' | 'ft';
  className?: string;
}

interface DiagramPoints {
  walls: {
    frontLeft: Point[];
    centreRight: Point[];
    farRight: Point[];
  };
  roof: {
    leftPlane: Point[];
    rightPlane: Point[];
    upperLeft: Point;
    upperCentre: Point;
    upperRight: Point;
    internalEave: Point;
    outerHipEave: Point;
  };
  hip: { start: Point; end: Point };
  valley: { start: Point; end: Point };
}

// ─── Helpers ────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

const MIN_PITCH = 5;
const MAX_PITCH = 50;
const MIN_RISE = 45;
const MAX_RISE = 190;

function riseFromPitch(pitchDegrees: number): number {
  const clamped = clamp(pitchDegrees, MIN_PITCH, MAX_PITCH);
  const t = (clamped - MIN_PITCH) / (MAX_PITCH - MIN_PITCH);
  return lerp(MIN_RISE, MAX_RISE, t);
}

// ─── Fixed footprint (NEVER moves with pitch) ───────
//
// viewBox 900 × 520. Eaves/wall-tops:
//   main block front eave:  (80,330) → (400,330)
//   internal wall corner:   (400,330)  ← valley lands here
//   wing front eave:        (400,330) → (580,372)
//   outer front corner:     (580,372)  ← hip lands here

const EAVE_LEFT: Point = { x: 80, y: 330 };
const INTERNAL_EAVE: Point = { x: 400, y: 330 };
const OUTER_HIP_EAVE: Point = { x: 580, y: 372 };

const WALL_FRONT_LEFT: Point[] = [
  { x: 80, y: 330 },
  { x: 400, y: 330 },
  { x: 400, y: 440 },
  { x: 80, y: 440 },
];

// Wing side wall — projects toward the viewer-right at an
// angle, creating the 90° internal corner at x=400.
const WALL_CENTRE_RIGHT: Point[] = [
  { x: 400, y: 330 },
  { x: 580, y: 372 },
  { x: 580, y: 482 },
  { x: 400, y: 440 },
];

// Narrow wing end wall (far right).
const WALL_FAR_RIGHT: Point[] = [
  { x: 580, y: 372 },
  { x: 638, y: 357 },
  { x: 638, y: 467 },
  { x: 580, y: 482 },
];

function pointsFromRise(roofRise: number): DiagramPoints {
  // Upper roof points — ONLY the Y coordinate depends on pitch.
  const upperLeft: Point = { x: 160, y: 330 - roofRise };        // main ridge, left end
  const upperCentre: Point = { x: 470, y: 326 - roofRise };      // ridge junction (valley start)
  const upperRight: Point = { x: 640, y: 366 - roofRise };       // wing ridge end (hip start)

  // Left (main) roof plane: front eave → internal corner → up the
  // valley to the ridge junction → back along the ridge.
  const leftPlane: Point[] = [EAVE_LEFT, INTERNAL_EAVE, upperCentre, upperLeft];

  // Right (wing) roof plane: internal corner → wing eave → up the
  // hip to the wing ridge end → back along the wing ridge.
  const rightPlane: Point[] = [INTERNAL_EAVE, OUTER_HIP_EAVE, upperRight, upperCentre];

  return {
    walls: {
      frontLeft: WALL_FRONT_LEFT,
      centreRight: WALL_CENTRE_RIGHT,
      farRight: WALL_FAR_RIGHT,
    },
    roof: {
      leftPlane,
      rightPlane,
      upperLeft,
      upperCentre,
      upperRight,
      internalEave: INTERNAL_EAVE,
      outerHipEave: OUTER_HIP_EAVE,
    },
    // Hip = wing's outer front arris (a real plane edge).
    hip: { start: upperRight, end: OUTER_HIP_EAVE },
    // Valley = shared fold between the two planes (a real plane edge).
    valley: { start: upperCentre, end: INTERNAL_EAVE },
  };
}

export function getHipValleyDiagramPoints(pitchDegrees: number): DiagramPoints {
  return pointsFromRise(riseFromPitch(pitchDegrees));
}

// ─── Smooth rise animation (200–250ms ease-out) ─────

function useAnimatedValue(target: number, durationMs = 220): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;
    const startTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const v = from + (target - from) * eased;
      valueRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

// ─── Water-flow arrow along a plane fall line ───────
//
// The fall line runs from a point on the ridge edge to the
// matching point on the eave edge, so arrows stay ON the
// plane and re-orient correctly at every pitch.

function fallLineArrow(
  ridgeA: Point, ridgeB: Point,
  eaveA: Point, eaveB: Point,
  across: number, from = 0.32, to = 0.64,
): { start: Point; end: Point } {
  const top = lerpPoint(ridgeA, ridgeB, across);
  const bottom = lerpPoint(eaveA, eaveB, across);
  return {
    start: lerpPoint(top, bottom, from),
    end: lerpPoint(top, bottom, to),
  };
}

function SlopeArrow({ start, end }: { start: Point; end: Point }) {
  const ang = Math.atan2(end.y - start.y, end.x - start.x);
  const s = 8;
  return (
    <g>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
      <polygon
        points={`${end.x},${end.y} ${end.x + s * Math.cos(ang + 2.6)},${end.y + s * Math.sin(ang + 2.6)} ${end.x + s * Math.cos(ang - 2.6)},${end.y + s * Math.sin(ang - 2.6)}`}
        fill="#1e293b"
      />
    </g>
  );
}

// ─── Main component ─────────────────────────────────

export function HipValleyHouseDiagram({
  pitchDegrees,
  hipSlopeDegrees,
  hipValleyLength,
  planLength,
  unit,
  className,
}: HipValleyHouseDiagramProps) {
  const animatedRise = useAnimatedValue(riseFromPitch(pitchDegrees));
  const pts = pointsFromRise(animatedRise);

  const poly = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(' ');

  const { upperLeft, upperCentre, upperRight } = pts.roof;

  // Single closed roof silhouette — guarantees a coherent shape.
  const silhouette =
    `M ${EAVE_LEFT.x},${EAVE_LEFT.y} ` +
    `L ${upperLeft.x},${upperLeft.y} ` +
    `L ${upperCentre.x},${upperCentre.y} ` +
    `L ${upperRight.x},${upperRight.y} ` +
    `L ${OUTER_HIP_EAVE.x},${OUTER_HIP_EAVE.y} ` +
    `L ${INTERNAL_EAVE.x},${INTERNAL_EAVE.y} Z`;

  // Water-flow arrows (2 on main plane, 1 on wing plane).
  const a1 = fallLineArrow(upperLeft, upperCentre, EAVE_LEFT, INTERNAL_EAVE, 0.35);
  const a2 = fallLineArrow(upperLeft, upperCentre, EAVE_LEFT, INTERNAL_EAVE, 0.72);
  const a3 = fallLineArrow(upperCentre, upperRight, INTERNAL_EAVE, OUTER_HIP_EAVE, 0.5);

  const hipMid = lerpPoint(pts.hip.start, pts.hip.end, 0.5);
  const valleyMid = lerpPoint(pts.valley.start, pts.valley.end, 0.5);

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      <svg
        viewBox="0 0 900 520"
        className="w-full"
        style={{ maxWidth: '820px', margin: '0 auto' }}
        role="img"
        aria-label={`Hip and valley roof pitch diagram at ${pitchDegrees.toFixed(1)} degrees`}
      >
        <title>Hip and valley roof pitch diagram</title>
        <desc>
          A simplified two-plane roof over three visible wall faces, showing a hip, a valley,
          and water flow at a pitch of {pitchDegrees.toFixed(1)} degrees.
        </desc>

        {/* ── 1-3. Walls (fixed footprint) ── */}
        <polygon points={poly(pts.walls.farRight)} fill="#eef2f7" stroke="#334155" strokeWidth="3" strokeLinejoin="round" />
        <polygon points={poly(pts.walls.centreRight)} fill="#f8fafc" stroke="#334155" strokeWidth="3" strokeLinejoin="round" />
        <polygon points={poly(pts.walls.frontLeft)} fill="#ffffff" stroke="#334155" strokeWidth="3" strokeLinejoin="round" />

        {/* 90° internal corner marker (fixed) */}
        <text x="386" y="462" textAnchor="end" fill="#64748b" style={{ fontSize: '12px', fontWeight: 500 }}>
          90°
        </text>
        <path d="M 400 426 L 388 429" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" fill="none" />

        {/* ── 4-5. Roof plane fills ── */}
        <polygon points={poly(pts.roof.leftPlane)} fill="rgba(59, 130, 246, 0.06)" stroke="none" />
        <polygon points={poly(pts.roof.rightPlane)} fill="rgba(59, 130, 246, 0.13)" stroke="none" />

        {/* ── 6. Roof outline (single coherent silhouette) ── */}
        <path d={silhouette} fill="none" stroke="#1e293b" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* ── 7. Hip line (solid orange) — wing outer arris ── */}
        <line
          x1={pts.hip.start.x} y1={pts.hip.start.y}
          x2={pts.hip.end.x} y2={pts.hip.end.y}
          stroke="#FF6B35" strokeWidth="4.5" strokeLinecap="round"
        />

        {/* ── 8. Valley line (dashed orange) — fold between the two planes ── */}
        <line
          x1={pts.valley.start.x} y1={pts.valley.start.y}
          x2={pts.valley.end.x} y2={pts.valley.end.y}
          stroke="#FF6B35" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="9 6"
        />

        {/* ── 9. Water-flow arrows ── */}
        <SlopeArrow start={a1.start} end={a1.end} />
        <SlopeArrow start={a2.start} end={a2.end} />
        <SlopeArrow start={a3.start} end={a3.end} />

        {/* ── 10. Labels + leader lines ── */}
        {/* Hip — right of the building, leader to hip midpoint */}
        <text x="700" y="310" fill="#1e293b" style={{ fontSize: '16px', fontWeight: 600 }}>Hip</text>
        <line
          x1="696" y1="304"
          x2={hipMid.x + 8} y2={hipMid.y + 2}
          stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3"
        />

        {/* Valley — on the main wall, leader up to valley midpoint */}
        <text x="255" y="392" fill="#1e293b" style={{ fontSize: '16px', fontWeight: 600 }}>Valley</text>
        <line
          x1="310" y1="386"
          x2={valleyMid.x - 6} y2={valleyMid.y + 4}
          stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3"
        />

        {/* ── 11. Measurement text (top-right, fixed region) ── */}
        <text x="870" y="42" textAnchor="end" fill="#3b82f6" style={{ fontSize: '15px', fontWeight: 600 }}>
          Pitch: {pitchDegrees.toFixed(1)}°
        </text>
        <text x="870" y="64" textAnchor="end" fill="#64748b" style={{ fontSize: '13px', fontWeight: 500 }}>
          Hip slope: {hipSlopeDegrees.toFixed(1)}°
        </text>
        <text x="870" y="86" textAnchor="end" fill="#FF6B35" style={{ fontSize: '14px', fontWeight: 600 }}>
          Hip/Valley: {hipValleyLength.toFixed(2)} {unit}
        </text>
        {planLength !== undefined && (
          <text x="870" y="106" textAnchor="end" fill="#94a3b8" style={{ fontSize: '12px' }}>
            Plan: {planLength.toFixed(2)} {unit}
          </text>
        )}

        {/* ── Legend (bottom-left, compact) ── */}
        <g transform="translate(80, 505)">
          <line x1="0" y1="0" x2="24" y2="0" stroke="#FF6B35" strokeWidth="4" strokeLinecap="round" />
          <text x="30" y="4" fill="#64748b" style={{ fontSize: '11px' }}>Hip (solid)</text>
          <line x1="115" y1="0" x2="139" y2="0" stroke="#FF6B35" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 4" />
          <text x="145" y="4" fill="#64748b" style={{ fontSize: '11px' }}>Valley (dashed)</text>
          <line x1="248" y1="0" x2="266" y2="0" stroke="#1e293b" strokeWidth="2.5" />
          <polygon points="266,0 261,-3 261,3" fill="#1e293b" />
          <text x="272" y="4" fill="#64748b" style={{ fontSize: '11px' }}>Water flow</text>
        </g>
      </svg>
      <p className="text-xs text-slate-400">
        Hip-and-valley roof at {pitchDegrees.toFixed(1)}° pitch — the valley drains into the 90° internal corner; the hip sits on the outer front corner
      </p>
    </div>
  );
}
