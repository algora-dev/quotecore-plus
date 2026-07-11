'use client';

/**
 * Shared SVG angle visualisers for the trade calculators.
 *
 * AngleVertexDiagram — two orange lines stemming from a centre point,
 * symmetric about 12 o'clock (a 90° angle "points" at 12, 180° is flat).
 * The rendered angle always mirrors the user's calculated result.
 *
 * BirdsmouthDiagram — orange rafter/stringer edges at the input pitch with
 * the two black dashed cut lines: A = horizontal seat cut, B = vertical
 * plumb cut, annotated with the angles to cut measured from the timber edge.
 */

const RAD = Math.PI / 180;

// ─── Vertex angle diagram ────────────────────────────

export function AngleVertexDiagram({
  angle,
  caption,
}: {
  /** Finished angle in degrees (0–360) */
  angle: number;
  caption?: string;
}) {
  const a = Math.max(1, Math.min(359, angle));

  const cx = 150;
  const cy = 120;
  const r = 85;

  // Rays symmetric about straight-up (12 o'clock).
  // Math convention: 90° points up; ray1 = 90 + a/2, ray2 = 90 − a/2.
  const half = a / 2;
  const a1 = (90 + half) * RAD;
  const a2 = (90 - half) * RAD;

  // SVG y is inverted
  const p1 = { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) };
  const p2 = { x: cx + r * Math.cos(a2), y: cy - r * Math.sin(a2) };

  // Interior arc between the rays (through 12 o'clock)
  const arcR = 30;
  const arcStart = { x: cx + arcR * Math.cos(a1), y: cy - arcR * Math.sin(a1) };
  const arcEnd = { x: cx + arcR * Math.cos(a2), y: cy - arcR * Math.sin(a2) };
  const largeArc = a > 180 ? 1 : 0;

  // Angle label sits above the centre, between the rays
  const labelR = arcR + 18;
  const label = { x: cx, y: cy - (a < 200 ? labelR : 8) };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 300 160" className="w-full max-w-xs">
        {/* Rays */}
        <line x1={cx} y1={cy} x2={p1.x} y2={p1.y} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={p2.x} y2={p2.y} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        {/* Arc */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        {/* Vertex */}
        <circle cx={cx} cy={cy} r="4" fill="#fff" stroke="#FF6B35" strokeWidth="2.5" />
        {/* Label */}
        <text x={label.x} y={label.y} textAnchor="middle" className="fill-slate-900" style={{ fontSize: '13px', fontWeight: 700 }}>
          {angle.toFixed(1)}°
        </text>
      </svg>
      {caption && <p className="text-xs text-slate-400">{caption}</p>}
    </div>
  );
}

// ─── Bird's mouth diagram ────────────────────────────

export function BirdsmouthDiagram({
  pitchDegrees,
  seatAngle,
  plumbAngle,
  memberWord,
  caption,
}: {
  pitchDegrees: number;
  /** Seat cut angle from the timber edge (= pitch) */
  seatAngle: number;
  /** Plumb cut angle from the timber edge (= 90 − pitch) */
  plumbAngle: number;
  memberWord: string;
  caption?: string;
}) {
  // Clamp drawing pitch so the diagram stays readable; calc values are shown as-is
  const p = Math.max(5, Math.min(55, pitchDegrees)) * RAD;

  const W = 300;
  const H = 190;

  // Bottom edge of the timber: rises to the right at pitch p.
  // Anchor so the notch sits centre-left.
  const t = 30; // timber thickness (px, perpendicular)
  const x0 = 20;
  const y0 = 158;
  const x1 = 285;
  const y1 = y0 - (x1 - x0) * Math.tan(p);

  // Edge direction (unit) and perpendicular pointing up from the bottom edge (SVG coords)
  const len = Math.hypot(x1 - x0, y1 - y0);
  const dx = (x1 - x0) / len;
  const dy = (y1 - y0) / len;
  const ux = dy;   // rotate dir by -90°: (dy, -dx)
  const uy = -dx;

  const topA = { x: x0 + ux * t, y: y0 + uy * t };
  const topB = { x: x1 + ux * t, y: y1 + uy * t };

  // Notch corner geometry — P_high on the bottom edge, seat runs left to C,
  // plumb drops from C to P_low on the bottom edge.
  const seatPx = 46; // horizontal seat length in px
  const hx = x0 + (x1 - x0) * 0.42; // P_high x
  const hy = y0 - (hx - x0) * Math.tan(p); // P_high y (on edge)
  const C = { x: hx - seatPx, y: hy };
  const lowY = y0 - (C.x - x0) * Math.tan(p); // edge y at C.x
  const Plow = { x: C.x, y: lowY };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md">
        {/* Top edge of timber */}
        <line x1={topA.x} y1={topA.y} x2={topB.x} y2={topB.y} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        {/* Bottom edge — drawn in two segments, skipping the notch */}
        <line x1={x0} y1={y0} x2={Plow.x} y2={Plow.y} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <line x1={hx} y1={hy} x2={x1} y2={y1} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />

        {/* Seat cut (A) — horizontal dashed, extended past C for the label */}
        <line x1={C.x - 26} y1={C.y} x2={hx} y2={hy} stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" />
        {/* Plumb cut (B) — vertical dashed, extended below P_low for the label */}
        <line x1={C.x} y1={C.y} x2={C.x} y2={Plow.y + 26} stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" />

        {/* Corner + edge points */}
        <circle cx={C.x} cy={C.y} r="3" fill="#0f172a" />
        <circle cx={hx} cy={hy} r="3" fill="#FF6B35" />
        <circle cx={Plow.x} cy={Plow.y} r="3" fill="#FF6B35" />

        {/* Labels */}
        <text x={C.x - 32} y={C.y + 4} textAnchor="end" className="fill-slate-900" style={{ fontSize: '12px', fontWeight: 700 }}>A</text>
        <text x={C.x} y={Plow.y + 40} textAnchor="middle" className="fill-slate-900" style={{ fontSize: '12px', fontWeight: 700 }}>B</text>

        {/* Cut-angle annotations */}
        <text x={hx + 8} y={hy - 8} className="fill-blue-600" style={{ fontSize: '10px', fontWeight: 600 }}>
          seat cut {seatAngle.toFixed(1)}° from edge
        </text>
        <text x={C.x + 8} y={Plow.y + 16} className="fill-blue-600" style={{ fontSize: '10px', fontWeight: 600 }}>
          plumb cut {plumbAngle.toFixed(1)}° from edge
        </text>

        {/* Pitch note top-left */}
        <text x={16} y={20} className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          {memberWord} at {pitchDegrees.toFixed(1)}°
        </text>
      </svg>
      {caption && <p className="text-xs text-slate-400">{caption}</p>}
    </div>
  );
}
