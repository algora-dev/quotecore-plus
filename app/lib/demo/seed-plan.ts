/** Real captured plan fixtures. The plan image is the public asset served at
 * /takeoff-demo/roofplan-baseline.png - a real plan measured in QuoteCore+
 * (RS Roofing, quote 1015, captured 2026-08-16), the same plan visitors of the
 * free takeoff demo already know. Geometry below mirrors the real captured AI
 * scan (app/(marketing)/takeoff-demo/demo-data/scan.json); all coordinates are
 * in the plan image's native pixel space (998 × 786). */
import scanJson from '@/app/(marketing)/takeoff-demo/demo-data/scan.json';

export const DEMO_PLAN_SIZE = { width: 998, height: 786 };

/** Real captured calibration: the 9.15 m bottom width drawn on the plan. */
export const DEMO_CALIBRATION: { id: string; point1: { x: number; y: number }; point2: { x: number; y: number }; pixelDistance: number; actualDistance: number; unit: string; scale: number }[] = [
  {
    id: 'demo-calibration-1',
    point1: { x: 86.52254641909815, y: 760.6339496035791 },
    point2: { x: 731.7931034482759, y: 760.6339496035791 },
    pixelDistance: 645.2705570291778,
    actualDistance: 9.15,
    unit: 'meters',
    scale: 0.014180098410388585,
  },
];

type ScanEntry = { points: { x: number; y: number }[] };
type RealScan = {
  roof_areas: { name: string; pitch_degrees: number; points: { x: number; y: number }[] }[];
  components: Record<string, ScanEntry[]>;
  pitch: { detected: boolean; global_degrees: number | null };
};
const REAL_SCAN = scanJson as unknown as RealScan;

export const DEMO_ROOF_AREA = REAL_SCAN.roof_areas[0];
export const DEMO_PITCH_DEGREES = REAL_SCAN.pitch.global_degrees ?? 25;

/** Class-tagged detection lines (R=ridge, H=hip, V=valley, B=barge, S=spouting)
 * from the real captured scan, so stage 3 maps each visitor-confirmed line back
 * to its real component class without guessing. */
export type PreparedLineClass = 'ridges' | 'hips' | 'valleys' | 'barges' | 'spouting';
export type PreparedLine = { id: string; cls: PreparedLineClass; start: { x: number; y: number }; end: { x: number; y: number } };
export const DEMO_LINES: PreparedLine[] = (['ridges', 'hips', 'valleys', 'barges', 'spouting'] as PreparedLineClass[]).flatMap(cls =>
  (REAL_SCAN.components[cls] ?? []).map((entry, index): PreparedLine => {
    const [a, b] = entry.points;
    return { id: `${cls[0].toUpperCase()}${index + 1}`, cls, start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } };
  }),
);

/** Metric helpers for the pre-measured state (all derived from the real
 * captured calibration - no hardcoded numbers). */
export function demoLineLengthM(line: PreparedLine): number {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) * DEMO_CALIBRATION[0].scale;
}
export function demoTotalLengthM(cls: PreparedLineClass): number {
  return DEMO_LINES.filter(l => l.cls === cls).reduce((sum, l) => sum + demoLineLengthM(l), 0);
}
export function demoRoofPlanAreaM2(): number {
  // Shoelace over the real captured polygon, scaled to metres.
  const pts = DEMO_ROOF_AREA.points;
  let px2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    px2 += a.x * b.y - b.x * a.y;
  }
  return (Math.abs(px2) / 2) * DEMO_CALIBRATION[0].scale * DEMO_CALIBRATION[0].scale;
}
