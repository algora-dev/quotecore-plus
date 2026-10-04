import { isRecord } from './model';
import { DEMO_PLAN_SIZE, DEMO_ROOF_AREA, DEMO_LINES, DEMO_PITCH_DEGREES } from './seed-plan';
import type { V3Point, V3Line } from '@/app/lib/takeoff/ai-prompt-v3';
export const PREPARED_SCAN_NOTICE = 'Prepared demo scan: replay of a real QuoteCore+ AI scan captured 2026-08-16. No AI call. Your edits and saved measurements are real.';
function dimension(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 4000) throw new Error('Invalid canvas dimensions'); return value; }
function point(value: unknown, width: number, height: number): V3Point {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 0 || value.y < 0 || value.x > width || value.y > height) throw new Error('Invalid prepared-plan point');
  return { x: value.x, y: value.y };
}
function polygon(value: unknown, width: number, height: number): V3Point[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 256) throw new Error('A valid roof outline is required');
  return value.map(p => point(p, width, height));
}
/** Fixtures use the EXISTING three-stage API contract against the real captured
 * plan (RS Roofing quote 1015). Stage 3 maps each visitor-confirmed line back to
 * its real component class via the tagged authored ids; it never fabricates a
 * canned result. */
export function preparedScanResponse(body: Record<string, unknown>) {
  if (!isRecord(body.canvasDimensions)) throw new Error('Canvas dimensions are required');
  const width = dimension(body.canvasDimensions.width), height = dimension(body.canvasDimensions.height);
  const scale = (p: { x: number; y: number }): V3Point => ({ x: p.x * width / DEMO_PLAN_SIZE.width, y: p.y * height / DEMO_PLAN_SIZE.height });
  const dimensions = { width, height };
  const notes = [PREPARED_SCAN_NOTICE, 'The prepared 9.15 m reference is already calibrated. Assign detections to priced components before saving.'];
  if (body.stage === 'scan1') {
    const roofAreas = [{ name: DEMO_ROOF_AREA.name, points: DEMO_ROOF_AREA.points.map(scale), pitch_degrees: DEMO_PITCH_DEGREES }];
    return { success: true, demo: true, stage: 'scan1', data: { roof_areas: roofAreas, notes },
      analysisDimensions: dimensions, canvasDimensions: dimensions, summary: { areas: 1, vertices: DEMO_ROOF_AREA.points.length, notes }, debugImages: {} };
  }
  const outline = polygon(body.outlinePoints, width, height);
  if (body.stage === 'scan2') {
    const lines: V3Line[] = DEMO_LINES.map(l => ({ id: l.id, start: scale(l.start), end: scale(l.end), confidence: 1 }));
    return { success: true, demo: true, stage: 'scan2', data: { lines, reviewLines: [], outlinePoints: outline, notes },
      analysisDimensions: dimensions, canvasDimensions: dimensions, summary: { rawLines: lines.length, finalLines: lines.length, reviewLines: 0, notes }, debugImages: {} };
  }
  if (body.stage !== 'scan3' || !Array.isArray(body.lines) || body.lines.length > 300) throw new Error('Invalid prepared scan stage');
  const lines: V3Line[] = body.lines.map((line: unknown) => {
    if (!isRecord(line) || typeof line.id !== 'string' || line.id.length > 100) throw new Error('Invalid detection');
    return { id: line.id, start: point(line.start,width,height), end: point(line.end,width,height), confidence: 1 };
  });
  type Entry = { points: V3Point[] };
  const components: Record<'ridges'|'hips'|'valleys'|'broken_hips'|'barges'|'spouting'|'uncertain', Entry[]> = {
    ridges: [], hips: [], valleys: [], broken_hips: [], barges: [], spouting: [], uncertain: [] };
  for (const line of lines) {
    const authored = DEMO_LINES.find(l => l.id === line.id);
    components[authored?.cls ?? 'uncertain'].push({ points: [line.start, line.end] });
  }
  const data = { scale: { detected: false, ratio: null, dimension_line: null }, pitch: { detected: true, global_degrees: DEMO_PITCH_DEGREES },
    roof_areas: [{ name: DEMO_ROOF_AREA.name, points: outline, pitch_degrees: DEMO_PITCH_DEGREES }], components, unresolved_corners: [], notes,
    stats: { demo: true, source: 'qcp-real-scan-replay-v2', providerCalls: 0 } };
  return { success: true, demo: true, stage: 'scan3', data, analysisDimensions: dimensions, canvasDimensions: dimensions,
    summary: { areas: 1, unresolvedCorners: 0, components: lines.length, ridges: components.ridges.length,
      hips: components.hips.length, valleys: components.valleys.length, broken_hips: 0, barges: components.barges.length, spouting: components.spouting.length, uncertain: components.uncertain.length, notes }, debugImages: {} };
}
