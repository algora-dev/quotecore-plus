'use client';

/**
 * Shared SVG angle visualisers for the trade calculators.
 *
 * AngleVertexDiagram - two orange lines stemming from a centre point,
 * symmetric about 12 o'clock (a 90° angle "points" at 12, 180° is flat).
 * The rendered angle always mirrors the user's calculated result.
 *
 * BirdsmouthDiagram - a DETAIL VIEW zoomed into the bird's mouth cut-out.
 * Orange rafter edges at the input pitch frame the notch and run off-frame
 * (SVG clips them); the two black dashed cut lines are the focus:
 * A = horizontal seat cut, B = vertical plumb cut.
 * Label zones: seat width above the seat line, heel left of the plumb line,
 * notch inside the cut-out void, A right of the upper opening, B below the
 * lower opening. White text halos keep labels legible at steep pitches.
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

  const half = a / 2;
  const a1 = (90 + half) * RAD;
  const a2 = (90 - half) * RAD;

  const p1 = { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) };
  const p2 = { x: cx + r * Math.cos(a2), y: cy - r * Math.sin(a2) };

  const arcR = 30;
  const arcStart = { x: cx + arcR * Math.cos(a1), y: cy - arcR * Math.sin(a1) };
  const arcEnd = { x: cx + arcR * Math.cos(a2), y: cy - arcR * Math.sin(a2) };
  const largeArc = a > 180 ? 1 : 0;

  const labelR = arcR + 18;
  const label = { x: cx, y: cy - (a < 200 ? labelR : 8) };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 300 160" className="w-full max-w-xs">
        <line x1={cx} y1={cy} x2={p1.x} y2={p1.y} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={p2.x} y2={p2.y} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        <circle cx={cx} cy={cy} r="4" fill="#fff" stroke="#FF6B35" strokeWidth="2.5" />
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
  seatWidth,
  heelHeight,
  notchDepth,
  rafterDepth,
  memberWord,
  unit,
  caption,
}: {
  pitchDegrees: number;
  /** Seat cut angle from the timber edge (= pitch) */
  seatAngle: number;
  /** Plumb cut angle from the timber edge (= 90 − pitch) */
  plumbAngle: number;
  /** Actual seat width value (for label) */
  seatWidth: number;
  /** Actual heel height value (for label) */
  heelHeight: number;
  /** Actual notch depth value (for label) */
  notchDepth: number;
  /** Actual rafter depth value (for label) */
  rafterDepth: number;
  memberWord: string;
  /** Unit label: "mm" or "in" */
  unit: string;
  caption?: string;
}) {
  // Work in a real coordinate system (x→right, y→up).
  // Rafter bottom edge: from (0,0) to (L, L·tan(p))
  const p = Math.max(5, Math.min(75, pitchDegrees)) * RAD;
  const L = 220; // rafter length in drawing units
  const D = 55;  // rafter depth in drawing units

  // Bottom edge endpoints
  const blStart = { x: 0, y: 0 };
  const blEnd   = { x: L, y: L * Math.tan(p) };

  // Notch geometry - P_high is on the bottom edge (upper-right notch opening)
  const Phx = L * 0.42;
  const Phy = Phx * Math.tan(p);

  // Seat cut goes horizontally LEFT from P_high to corner C
  const seatLen = 42;
  const C = { x: Phx - seatLen, y: Phy };

  // Plumb cut goes vertically DOWN from C to P_low (lower-left notch opening)
  const Plow = { x: C.x, y: C.x * Math.tan(p) };

  // Direction and perpendicular for top edge (top edge may sit off-frame in
  // the detail view - that is intentional)
  const dirLen = Math.hypot(1, Math.tan(p));
  const dirN = { x: 1 / dirLen, y: Math.tan(p) / dirLen };
  const perp = { x: -dirN.y, y: dirN.x };

  const tlStart = { x: blStart.x + perp.x * D, y: blStart.y + perp.y * D };
  const tlEnd   = { x: blEnd.x + perp.x * D,   y: blEnd.y + perp.y * D };

  // ── ZOOM: frame ONLY the notch (C, P_high, P_low), not the whole rafter ──
  // Generous asymmetric padding reserves a dedicated clear zone for each
  // label so nothing touches the dotted lines or the orange timber edges.
  const VB_W = 400;
  const VB_H = 300;
  const padL = 105; // "Heel =" zone, left of the plumb line
  const padR = 85;  // "A =" zone, right of the upper seat opening
  const padT = 55;  // "Seat width =" zone, above the seat line
  const padB = 65;  // "B =" zone, below the lower plumb opening
  const minX = C.x;
  const maxX = Phx;
  const minY = Plow.y;
  const maxY = C.y;
  const realW = maxX - minX;
  const realH = maxY - minY;
  const scale = Math.min((VB_W - padL - padR) / realW, (VB_H - padT - padB) / realH);

  // Centre the notch inside the padded content area (real → SVG, flip y)
  const exX = (VB_W - padL - padR - realW * scale) / 2;
  const exY = (VB_H - padT - padB - realH * scale) / 2;
  const sx = (x: number) => padL + exX + (x - minX) * scale;
  const sy = (y: number) => padT + exY + (maxY - y) * scale;

  // Vertical midpoint of the plumb cut - Heel sits left of it, Notch right
  const plumbMidY = (C.y + Plow.y) / 2;

  // Angle arcs (screen space). Seat arc at P_high between the seat cut and
  // the void; plumb arc at P_low between the plumb cut and the void.
  const arcR = 20;
  const seatArcStart = { x: sx(Phx) - arcR, y: sy(Phy) };
  const seatArcEnd   = { x: sx(Phx) - arcR * Math.cos(p), y: sy(Phy) + arcR * Math.sin(p) };
  const plumbArcStart = { x: sx(Plow.x), y: sy(Plow.y) - arcR };
  const plumbArcEnd   = { x: sx(Plow.x) + arcR * Math.cos(p), y: sy(Plow.y) - arcR * Math.sin(p) };

  // White halo keeps text legible if an orange edge passes behind it
  const halo = { paintOrder: 'stroke' as const, stroke: '#fff', strokeWidth: 4 };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full max-w-md">
        {/* Top edge of rafter */}
        <line x1={sx(tlStart.x)} y1={sy(tlStart.y)} x2={sx(tlEnd.x)} y2={sy(tlEnd.y)} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />

        {/* Bottom edge - two segments skipping the notch */}
        <line x1={sx(blStart.x)} y1={sy(blStart.y)} x2={sx(Plow.x)} y2={sy(Plow.y)} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <line x1={sx(Phx)} y1={sy(Phy)} x2={sx(blEnd.x)} y2={sy(blEnd.y)} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />

        {/* Seat cut (A) - horizontal dashed */}
        <line x1={sx(C.x)} y1={sy(C.y)} x2={sx(Phx)} y2={sy(Phy)} stroke="#0f172a" strokeWidth="2" strokeDasharray="6 4" />

        {/* Plumb cut (B) - vertical dashed */}
        <line x1={sx(C.x)} y1={sy(C.y)} x2={sx(Plow.x)} y2={sy(Plow.y)} stroke="#0f172a" strokeWidth="2" strokeDasharray="6 4" />

        {/* Angle arc at P_high - seat cut angle A */}
        <path
          d={`M ${seatArcStart.x} ${seatArcStart.y} A ${arcR} ${arcR} 0 0 0 ${seatArcEnd.x} ${seatArcEnd.y}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />

        {/* Angle arc at P_low - plumb cut angle B */}
        <path
          d={`M ${plumbArcStart.x} ${plumbArcStart.y} A ${arcR} ${arcR} 0 0 1 ${plumbArcEnd.x} ${plumbArcEnd.y}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />

        {/* Corner + edge points */}
        <circle cx={sx(C.x)} cy={sy(C.y)} r="3.5" fill="#0f172a" />
        <circle cx={sx(Phx)} cy={sy(Phy)} r="3.5" fill="#FF6B35" />
        <circle cx={sx(Plow.x)} cy={sy(Plow.y)} r="3.5" fill="#FF6B35" />

        {/* Seat width - ABOVE the horizontal dotted seat line, centred on it */}
        <text x={sx((C.x + Phx) / 2)} y={sy(C.y) - 14} textAnchor="middle" className="fill-slate-700" style={{ fontSize: '12px', fontWeight: 600, ...halo }}>
          Seat width = {seatWidth.toFixed(0)}{unit}
        </text>

        {/* Heel - LEFT of the vertical dotted plumb line, vertically centred */}
        <text x={sx(C.x) - 12} y={sy(plumbMidY) + 4} textAnchor="end" className="fill-slate-700" style={{ fontSize: '12px', fontWeight: 600, ...halo }}>
          Heel = {heelHeight.toFixed(0)}{unit}
        </text>

        {/* Notch - INSIDE the cut-out void, just right of the dotted corner */}
        <text x={sx(C.x) + 14} y={sy(plumbMidY) + 4} textAnchor="start" className="fill-slate-700" style={{ fontSize: '12px', fontWeight: 600, ...halo }}>
          Notch = {notchDepth.toFixed(0)}{unit}
        </text>

        {/* A - RIGHT of the upper seat cut opening, aligned with the cut */}
        <text x={sx(Phx) + 14} y={sy(Phy) + 5} textAnchor="start" className="fill-blue-600" style={{ fontSize: '13px', fontWeight: 700, ...halo }}>
          A = {seatAngle.toFixed(1)}°
        </text>

        {/* B - BELOW the lower plumb cut opening, aligned with the cut */}
        <text x={sx(Plow.x) + 8} y={sy(Plow.y) + 30} textAnchor="start" className="fill-blue-600" style={{ fontSize: '13px', fontWeight: 700, ...halo }}>
          B = {plumbAngle.toFixed(1)}°
        </text>

        {/* Pitch note top-left */}
        <text x={12} y={18} className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500, ...halo, strokeWidth: 3 }}>
          {memberWord} at {pitchDegrees.toFixed(1)}° · depth {rafterDepth.toFixed(0)}{unit} - bird&apos;s mouth detail
        </text>
      </svg>
      {caption && <p className="text-xs text-slate-400">{caption}</p>}
    </div>
  );
}
