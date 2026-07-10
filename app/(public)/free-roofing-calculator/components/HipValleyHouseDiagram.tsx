'use client';

import { useMemo } from 'react';

// ─── Types ──────────────────────────────────────────

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

function getHipValleyDiagramPoints(pitchDegrees: number): DiagramPoints {
  const minPitch = 5;
  const maxPitch = 50;
  const clampedPitch = clamp(pitchDegrees, minPitch, maxPitch);
  const t = (clampedPitch - minPitch) / (maxPitch - minPitch);

  const minRise = 45;
  const maxRise = 190;
  const roofRise = lerp(minRise, maxRise, t);

  // ─── Fixed wall footprint (NEVER changes with pitch) ───
  // Three visible wall faces forming an L-shaped building
  // viewBox is 900 × 520

  const wallTopY = 340;      // top of walls (eaves line)
  const wallBottomY = 480;   // ground line

  // Front-left wall (wide, faces viewer-left)
  const frontLeft: Point[] = [
    { x: 80,  y: wallBottomY },  // bottom-left
    { x: 80,  y: wallTopY },     // top-left (eaves)
    { x: 340, y: wallTopY },     // top-right (meets centre wall)
    { x: 340, y: wallBottomY },  // bottom-right
  ];

  // Centre/right wall (angled, faces viewer-front)
  // This wall goes from the front-left wall's right edge inward (creating the internal corner)
  // then out to the right
  const centreRight: Point[] = [
    { x: 340, y: wallBottomY },  // bottom-left (shared with frontLeft)
    { x: 340, y: wallTopY },     // top-left (internal corner top)
    { x: 560, y: wallTopY },     // top-right
    { x: 560, y: wallBottomY },  // bottom-right
  ];

  // Far-right wall (narrow, angled away)
  const farRight: Point[] = [
    { x: 560, y: wallBottomY },
    { x: 560, y: wallTopY },
    { x: 680, y: wallTopY - 10 },  // slightly higher = receding
    { x: 680, y: wallBottomY - 30 },
  ];

  // ─── Eave points (fixed — on wall tops) ───
  const eaveLeft     = { x: 80,  y: wallTopY };
  const eaveRight    = { x: 680, y: wallTopY - 10 };
  const internalEave = { x: 340, y: wallTopY };   // internal corner (valley endpoint)
  const outerHipEave = { x: 560, y: wallTopY };   // external corner (hip endpoint)

  // ─── Roof ridge points (move vertically with pitch) ───
  // The ridge line sits above the walls
  const baseRidgeY = wallTopY - roofRise;

  // Upper points — only Y changes with pitch
  const upperLeft   = { x: 120, y: baseRidgeY };
  const upperCentre = { x: 400, y: baseRidgeY - 12 };  // slight peak at centre
  const upperRight  = { x: 640, y: baseRidgeY - 4 };

  // ─── Hip line: from upper roof junction down to outer hip eave corner ───
  const hipStart = { x: 180, y: baseRidgeY + 2 };
  const hipEnd   = outerHipEave;  // { x: 560, y: 340 }

  // ─── Valley line: from upper ridge junction down to internal eave corner ───
  const valleyStart = { x: 460, y: baseRidgeY - 2 };
  const valleyEnd   = internalEave;  // { x: 340, y: 340 }

  // ─── Roof planes ───
  // Left plane: eaveLeft → internalEave → upperCentre → upperLeft
  const leftPlane: Point[] = [
    eaveLeft,
    internalEave,
    upperCentre,
    upperLeft,
  ];

  // Right plane: internalEave → eaveRight → upperRight → upperCentre
  const rightPlane: Point[] = [
    internalEave,
    eaveRight,
    upperRight,
    upperCentre,
  ];

  return {
    walls: { frontLeft, centreRight, farRight },
    roof: {
      leftPlane,
      rightPlane,
      upperLeft,
      upperCentre,
      upperRight,
      internalEave,
      outerHipEave,
    },
    hip: { start: hipStart, end: hipEnd },
    valley: { start: valleyStart, end: valleyEnd },
  };
}

// ─── Slope arrow helper ─────────────────────────────

function SlopeArrow({ start, end, color = '#1e293b' }: { start: Point; end: Point; color?: string }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const ang = Math.atan2(dy, dx);
  const s = 8;
  return (
    <g>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <polygon
        points={`${end.x},${end.y} ${end.x + s * Math.cos(ang + 2.6)},${end.y + s * Math.sin(ang + 2.6)} ${end.x + s * Math.cos(ang - 2.6)},${end.y + s * Math.sin(ang - 2.6)}`}
        fill={color}
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
  const pts = useMemo(() => getHipValleyDiagramPoints(pitchDegrees), [pitchDegrees]);

  const polygonStr = (points: Point[]) => points.map(p => `${p.x},${p.y}`).join(' ');

  // Water flow arrows — fixed direction (down the roof planes)
  const arrow1 = {
    start: { x: 150, y: pts.roof.upperLeft.y + (pts.roof.internalEave.y - pts.roof.upperLeft.y) * 0.3 },
    end:   { x: 130, y: pts.roof.upperLeft.y + (pts.roof.internalEave.y - pts.roof.upperLeft.y) * 0.6 },
  };
  const arrow2 = {
    start: { x: 280, y: pts.roof.upperCentre.y + (pts.roof.internalEave.y - pts.roof.upperCentre.y) * 0.3 },
    end:   { x: 310, y: pts.roof.upperCentre.y + (pts.roof.internalEave.y - pts.roof.upperCentre.y) * 0.6 },
  };
  const arrow3 = {
    start: { x: 520, y: pts.roof.upperRight.y + (pts.roof.internalEave.y - pts.roof.upperRight.y) * 0.3 },
    end:   { x: 550, y: pts.roof.upperRight.y + (pts.roof.internalEave.y - pts.roof.upperRight.y) * 0.55 },
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      <svg
        viewBox="0 0 900 520"
        className="w-full"
        style={{ maxWidth: '820px', aspectRatio: '900 / 520', margin: '0 auto' }}
        role="img"
        aria-label={`Hip and valley roof pitch diagram at ${pitchDegrees.toFixed(1)} degrees`}
      >
        <title>Hip and valley roof pitch diagram</title>
        <desc>
          A simplified two-plane roof over three visible wall faces, showing a hip, a valley, and water flow at a pitch of {pitchDegrees.toFixed(1)} degrees.
        </desc>

        {/* ── Layer 1-3: Walls ── */}
        {/* Back wall (far right — receding, subtle grey) */}
        <polygon
          points={polygonStr(pts.walls.farRight)}
          fill="#f1f5f9"
          stroke="#334155"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Centre/right wall face */}
        <polygon
          points={polygonStr(pts.walls.centreRight)}
          fill="#f8fafc"
          stroke="#334155"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Front-left wall face */}
        <polygon
          points={polygonStr(pts.walls.frontLeft)}
          fill="#ffffff"
          stroke="#334155"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Wall label */}
        <text x="200" y="510" textAnchor="middle" fill="#64748b" style={{ fontSize: '13px', fontWeight: 500 }}>
          wall
        </text>
        <text x="450" y="510" textAnchor="middle" fill="#64748b" style={{ fontSize: '13px', fontWeight: 500 }}>
          wall
        </text>
        <text x="620" y="510" textAnchor="middle" fill="#64748b" style={{ fontSize: '13px', fontWeight: 500 }}>
          wall
        </text>

        {/* Internal corner marker */}
        <circle cx={pts.roof.internalEave.x} cy={pts.roof.internalEave.y} r="4" fill="#64748b" />
        <text x={pts.roof.internalEave.x - 12} y={pts.roof.internalEave.y + 18} fill="#94a3b8" style={{ fontSize: '10px' }}>
          int corner
        </text>

        {/* External corner marker */}
        <circle cx={pts.roof.outerHipEave.x} cy={pts.roof.outerHipEave.y} r="4" fill="#64748b" />
        <text x={pts.roof.outerHipEave.x + 8} y={pts.roof.outerHipEave.y + 18} fill="#94a3b8" style={{ fontSize: '10px' }}>
          ext corner
        </text>

        {/* ── Layer 4-5: Roof plane fills ── */}
        <polygon
          points={polygonStr(pts.roof.leftPlane)}
          fill="rgba(59, 130, 246, 0.06)"
          stroke="none"
        />
        <polygon
          points={polygonStr(pts.roof.rightPlane)}
          fill="rgba(59, 130, 246, 0.12)"
          stroke="none"
        />

        {/* ── Layer 6: Roof outline ── */}
        {/* Left roof plane outline */}
        <polygon
          points={polygonStr(pts.roof.leftPlane)}
          fill="none"
          stroke="#1e293b"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Right roof plane outline */}
        <polygon
          points={polygonStr(pts.roof.rightPlane)}
          fill="none"
          stroke="#1e293b"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Ridge line (top of roof) */}
        <line
          x1={pts.roof.upperLeft.x}
          y1={pts.roof.upperLeft.y}
          x2={pts.roof.upperRight.x}
          y2={pts.roof.upperRight.y}
          stroke="#1e293b"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* ── Layer 7: Hip line (solid orange) ── */}
        <line
          x1={pts.hip.start.x}
          y1={pts.hip.start.y}
          x2={pts.hip.end.x}
          y2={pts.hip.end.y}
          stroke="#FF6B35"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* ── Layer 8: Valley line (dashed orange) ── */}
        <line
          x1={pts.valley.start.x}
          y1={pts.valley.start.y}
          x2={pts.valley.end.x}
          y2={pts.valley.end.y}
          stroke="#FF6B35"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="10 6"
        />

        {/* ── Layer 9: Water-flow arrows ── */}
        <SlopeArrow start={arrow1.start} end={arrow1.end} />
        <SlopeArrow start={arrow2.start} end={arrow2.end} />
        <SlopeArrow start={arrow3.start} end={arrow3.end} />

        {/* ── Layer 10: Labels ── */}
        {/* Hip label — top left, leader to hip line */}
        <text x="30" y="60" fill="#1e293b" style={{ fontSize: '16px', fontWeight: 600 }}>
          Hip
        </text>
        <line
          x1="55" y1="65"
          x2={(pts.hip.start.x + pts.hip.end.x) / 2 - 10}
          y2={(pts.hip.start.y + pts.hip.end.y) / 2 - 5}
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* Valley label — lower right, leader to valley line */}
        <text x={pts.valley.end.x - 70} y={pts.valley.end.y + 50} fill="#1e293b" style={{ fontSize: '16px', fontWeight: 600 }}>
          Valley
        </text>
        <line
          x1={pts.valley.end.x - 45}
          y1={pts.valley.end.y + 45}
          x2={(pts.valley.start.x + pts.valley.end.x) / 2 + 8}
          y2={(pts.valley.start.y + pts.valley.end.y) / 2 + 5}
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* ── Layer 11: Measurement text (top-right) ── */}
        <text x="870" y="40" textAnchor="end" fill="#3b82f6" style={{ fontSize: '15px', fontWeight: 600 }}>
          Pitch: {pitchDegrees.toFixed(1)}°
        </text>
        <text x="870" y="62" textAnchor="end" fill="#64748b" style={{ fontSize: '13px', fontWeight: 500 }}>
          Hip slope: {hipSlopeDegrees.toFixed(1)}°
        </text>
        <text x="870" y="82" textAnchor="end" fill="#FF6B35" style={{ fontSize: '14px', fontWeight: 600 }}>
          Hip/Valley: {hipValleyLength.toFixed(2)} {unit}
        </text>
        {planLength !== undefined && (
          <text x="870" y="102" textAnchor="end" fill="#94a3b8" style={{ fontSize: '12px' }}>
            Plan: {planLength.toFixed(2)} {unit}
          </text>
        )}

        {/* ── Legend (bottom-left, compact) ── */}
        <g transform="translate(30, 470)">
          <line x1="0" y1="0" x2="24" y2="0" stroke="#FF6B35" strokeWidth="4" strokeLinecap="round" />
          <text x="30" y="4" fill="#64748b" style={{ fontSize: '11px' }}>Hip (solid)</text>
          <line x1="120" y1="0" x2="144" y2="0" stroke="#FF6B35" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 4" />
          <text x="150" y="4" fill="#64748b" style={{ fontSize: '11px' }}>Valley (dashed)</text>
          <line x1="250" y1="0" x2="268" y2="0" stroke="#1e293b" strokeWidth="2.5" />
          <polygon points="268,0 263,-3 263,3" fill="#1e293b" />
          <text x="274" y="4" fill="#64748b" style={{ fontSize: '11px' }}>Water flow</text>
        </g>
      </svg>
      <p className="text-xs text-slate-400">
        Hip-and-valley roof at {pitchDegrees.toFixed(1)}° pitch — external corner (hip) juts out, internal corner (valley) recedes in
      </p>
    </div>
  );
}
