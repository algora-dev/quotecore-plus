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
 * plumb cut, annotated with the angles and measurements.
 * Dynamic scaling ensures the entire rafter fits within the viewBox at any
 * pitch from 5° to 75°.
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

  // Notch geometry — P_high is on the bottom edge (right side of notch)
  const Phx = L * 0.42;
  const Phy = Phx * Math.tan(p);

  // Seat cut goes horizontally LEFT from P_high to corner C
  const seatLen = 42;
  const C = { x: Phx - seatLen, y: Phy };

  // Plumb cut goes vertically DOWN from C to P_low on the bottom edge
  const Plow = { x: C.x, y: C.x * Math.tan(p) };

  // Direction and perpendicular for top edge
  const dirLen = Math.hypot(1, Math.tan(p));
  const dirN = { x: 1 / dirLen, y: Math.tan(p) / dirLen };
  // Perpendicular pointing "up" (away from rafter body)
  const perp = { x: -dirN.y, y: dirN.x };

  const tlStart = { x: blStart.x + perp.x * D, y: blStart.y + perp.y * D };
  const tlEnd   = { x: blEnd.x + perp.x * D,   y: blEnd.y + perp.y * D };

  // Heel point: where the seat cut meets the top edge (vertically above C)
  const heelTop = { x: C.x + perp.x * D, y: C.y + perp.y * D };

  // ── Bounding box ──
  const allX = [blStart.x, blEnd.x, tlStart.x, tlEnd.x, C.x, Phx, Plow.x, heelTop.x];
  const allY = [blStart.y, blEnd.y, tlStart.y, tlEnd.y, C.y, Phy, Plow.y, heelTop.y];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  // ── Scale to fit viewBox ──
  const VB_W = 340;
  const VB_H = 260;
  const padX = 40;
  const padY = 30;
  const realW = maxX - minX;
  const realH = maxY - minY;
  const scale = Math.min((VB_W - 2 * padX) / realW, (VB_H - 2 * padY) / realH);

  // Transform: real → SVG (flip y)
  const ox = padX - minX * scale;
  const oy = VB_H - padY + minY * scale;
  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy - y * scale;

  // Midpoints for labels
  const midSeat  = { x: (C.x + Phx) / 2, y: C.y };
  const midPlumb = { x: C.x, y: (C.y + Plow.y) / 2 };
  const midHeel  = { x: (C.x + heelTop.x) / 2, y: (C.y + heelTop.y) / 2 };
  // Notch depth: perpendicular from Plow to C (approximate visual midpoint)
  const midNotch = { x: (C.x + Plow.x) / 2 + 8, y: (C.y + Plow.y) / 2 };

  // Angle arc for seat cut (at P_high, between bottom edge and seat line)
  const arcR = 16;
  const arcSeatEnd  = { x: sx(Phx - arcR), y: sy(Phy) };
  const arcSeatCtrl = { x: sx(Phx - arcR * Math.cos(p)), y: sy(Phy - arcR * Math.sin(p)) };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full max-w-md">
        {/* Top edge of rafter */}
        <line x1={sx(tlStart.x)} y1={sy(tlStart.y)} x2={sx(tlEnd.x)} y2={sy(tlEnd.y)} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />

        {/* Bottom edge — two segments skipping the notch */}
        <line x1={sx(blStart.x)} y1={sy(blStart.y)} x2={sx(Plow.x)} y2={sy(Plow.y)} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
        <line x1={sx(Phx)} y1={sy(Phy)} x2={sx(blEnd.x)} y2={sy(blEnd.y)} stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />

        {/* Seat cut (A) — horizontal dashed */}
        <line x1={sx(C.x)} y1={sy(C.y)} x2={sx(Phx)} y2={sy(Phy)} stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" />

        {/* Plumb cut (B) — vertical dashed */}
        <line x1={sx(C.x)} y1={sy(C.y)} x2={sx(Plow.x)} y2={sy(Plow.y)} stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" />

        {/* Heel height indicator (vertical dotted from C to top edge) */}
        <line x1={sx(C.x)} y1={sy(C.y)} x2={sx(heelTop.x)} y2={sy(heelTop.y)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

        {/* Angle arc at P_high (seat cut angle) */}
        <path
          d={`M ${arcSeatEnd.x} ${arcSeatEnd.y} A ${arcR} ${arcR} 0 0 1 ${arcSeatCtrl.x} ${arcSeatCtrl.y}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />

        {/* Corner + edge points */}
        <circle cx={sx(C.x)} cy={sy(C.y)} r="3" fill="#0f172a" />
        <circle cx={sx(Phx)} cy={sy(Phy)} r="3" fill="#FF6B35" />
        <circle cx={sx(Plow.x)} cy={sy(Plow.y)} r="3" fill="#FF6B35" />

        {/* Seat width label */}
        <text x={sx(midSeat.x)} y={sy(midSeat.y) - 7} textAnchor="middle" className="fill-slate-600" style={{ fontSize: '10px', fontWeight: 500 }}>
          Seat width
        </text>
        <text x={sx(midSeat.x)} y={sy(midSeat.y) + 4} textAnchor="middle" className="fill-slate-500" style={{ fontSize: '10px' }}>
          {seatWidth.toFixed(0)}{unit}
        </text>

        {/* Heel height label — moved left to avoid overlap */}
        <text x={sx(midHeel.x) - 12} y={sy(midHeel.y) - 2} textAnchor="end" className="fill-slate-600" style={{ fontSize: '10px', fontWeight: 500 }}>
          Heel
        </text>
        <text x={sx(midHeel.x) - 12} y={sy(midHeel.y) + 8} textAnchor="end" className="fill-slate-500" style={{ fontSize: '10px' }}>
          {heelHeight.toFixed(0)}{unit}
        </text>

        {/* Notch depth label — moved right to avoid overlap */}
        <text x={sx(midNotch.x) + 22} y={sy(midNotch.y) - 2} textAnchor="start" className="fill-slate-600" style={{ fontSize: '10px', fontWeight: 500 }}>
          Notch
        </text>
        <text x={sx(midNotch.x) + 22} y={sy(midNotch.y) + 8} textAnchor="start" className="fill-slate-500" style={{ fontSize: '10px' }}>
          {notchDepth.toFixed(0)}{unit}
        </text>

        {/* Seat cut angle annotation (blue, 50% larger) */}
        <text x={sx(Phx) + 10} y={sy(Phy) - 10} className="fill-blue-600" style={{ fontSize: '14px', fontWeight: 700 }}>
          A = {seatAngle.toFixed(1)}°
        </text>

        {/* Plumb cut angle annotation (blue, 50% larger) */}
        <text x={sx(C.x) + 10} y={sy(Plow.y) + 18} className="fill-blue-600" style={{ fontSize: '14px', fontWeight: 700 }}>
          B = {plumbAngle.toFixed(1)}°
        </text>

        {/* Pitch note top-left */}
        <text x={12} y={18} className="fill-slate-500" style={{ fontSize: '10px', fontWeight: 500 }}>
          {memberWord} at {pitchDegrees.toFixed(1)}°
        </text>

        {/* Rafter depth label on top edge */}
        <text x={sx(tlEnd.x) - 4} y={sy(tlEnd.y) - 6} textAnchor="end" className="fill-slate-400" style={{ fontSize: '9px' }}>
          depth {rafterDepth.toFixed(0)}{unit}
        </text>
      </svg>
      {caption && <p className="text-xs text-slate-400">{caption}</p>}
    </div>
  );
}
