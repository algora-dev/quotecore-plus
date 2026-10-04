import { isRecord } from './model';
import { DEMO_PLAN_SIZE, DEMO_ROOF_OUTLINE } from './seed-plan';
import type { V3Point, V3Line } from '@/app/lib/takeoff/ai-prompt-v3';
export const PREPARED_SCAN_NOTICE = 'Prepared demo scan: authored detections, no AI call. Your edits and saved measurements are real.';
function dimension(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 4000) throw new Error('Invalid canvas dimensions'); return value; }
function point(value: unknown, width: number, height: number): V3Point {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 0 || value.y < 0 || value.x > width || value.y > height) throw new Error('Invalid prepared-plan point');
  return { x: value.x, y: value.y };
}
function polygon(value: unknown, width: number, height: number): V3Point[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 256) throw new Error('A valid roof outline is required');
  return value.map(p => point(p, width, height));
}
/** Fixtures use the EXISTING three-stage API contract. Stage 3 copies the
 * visitor-confirmed coordinates verbatim; it never restores a canned outline. */
export function preparedScanResponse(body: Record<string, unknown>) {
  if (!isRecord(body.canvasDimensions)) throw new Error('Canvas dimensions are required');
  const width = dimension(body.canvasDimensions.width), height = dimension(body.canvasDimensions.height);
  const scale = (p: V3Point): V3Point => ({ x: p.x * width / DEMO_PLAN_SIZE.width, y: p.y * height / DEMO_PLAN_SIZE.height });
  const dimensions = { width, height };
  const notes = [PREPARED_SCAN_NOTICE, 'The prepared 16.80 m reference is already calibrated. Assign detections to priced components before saving.'];
  if (body.stage === 'scan1') {
    const roofAreas = [{ name: 'Prepared QCP roof', points: DEMO_ROOF_OUTLINE.map(scale), pitch_degrees: 0 }];
    return { success: true, demo: true, stage: 'scan1', data: { roof_areas: roofAreas, notes },
      analysisDimensions: dimensions, canvasDimensions: dimensions, summary: { areas: 1, vertices: 4, notes }, debugImages: {} };
  }
  const outline = polygon(body.outlinePoints, width, height);
  if (body.stage === 'scan2') {
    const raw: [V3Point,V3Point][] = [
      [{x:450,y:450},{x:750,y:450}], [{x:180,y:180},{x:450,y:450}],
      [{x:180,y:720},{x:450,y:450}], [{x:1020,y:180},{x:750,y:450}],
      [{x:1020,y:720},{x:750,y:450}],
    ];
    const lines = raw.map(([a,b], i) => ({ id: `L${i+1}`, start: scale(a), end: scale(b), confidence: 1 }));
    return { success: true, demo: true, stage: 'scan2', data: { lines, reviewLines: [], outlinePoints: outline, notes },
      analysisDimensions: dimensions, canvasDimensions: dimensions, summary: { rawLines: lines.length, finalLines: lines.length, reviewLines: 0, notes }, debugImages: {} };
  }
  if (body.stage !== 'scan3' || !Array.isArray(body.lines) || body.lines.length > 300) throw new Error('Invalid prepared scan stage');
  const lines: V3Line[] = body.lines.map((line: unknown) => {
    if (!isRecord(line) || typeof line.id !== 'string' || line.id.length > 100) throw new Error('Invalid detection');
    return { id: line.id, start: point(line.start,width,height), end: point(line.end,width,height), confidence: 1 };
  });
  type Entry = { points: V3Point[] };
  const components = { ridges: [] as Entry[], hips: [] as Entry[], valleys: [] as Entry[], broken_hips: [] as Entry[],
    barges: [] as Entry[], spouting: [] as Entry[], uncertain: [] as Entry[] };
  for (const line of lines) {
    const key = line.id === 'L1' ? 'ridges' : /^L[2-5]$/.test(line.id) ? 'hips' : 'uncertain';
    components[key].push({ points: [line.start, line.end] });
  }
  // The normal applyAiResults perimeter-accounting engine handles these edges.
  outline.forEach((p,i) => components.spouting.push({ points: [p, outline[(i+1)%outline.length]] }));
  const data = { scale: { detected: false, ratio: null, dimension_line: null }, pitch: { detected: false, global_degrees: null },
    roof_areas: [{ name: 'Prepared QCP roof', points: outline, pitch_degrees: 0 }], components, unresolved_corners: [], notes,
    stats: { demo: true, source: 'qcp-authored-fixture-v1', providerCalls: 0 } };
  return { success: true, demo: true, stage: 'scan3', data, analysisDimensions: dimensions, canvasDimensions: dimensions,
    summary: { areas: 1, unresolvedCorners: 0, components: lines.length + outline.length, ridges: components.ridges.length,
      hips: components.hips.length, valleys: 0, broken_hips: 0, barges: 0, spouting: outline.length, uncertain: components.uncertain.length, notes }, debugImages: {} };
}
