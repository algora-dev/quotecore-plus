/**
 * Shared AI scan pipeline glue (2026-10-02, Darren).
 *
 * Extracted verbatim from app/api/takeoff/ai-scan-v3/route.ts so the
 * anonymous free-tool scan route (/api/free-tools/ai-scan) runs the EXACT
 * same model calls + geometry post-processing as the paid in-app path.
 *
 * NOTE: ai-scan-v3 still carries its own copies of these helpers. When this
 * branch is folded (Gavin), switch that route to import from here so the
 * two paths cannot drift. Until then, any edit here should be mirrored
 * in the v3 route.
 */

import OpenAI from 'openai';
import sharp from 'sharp';
import { outlineToEdgeLines } from '@/app/lib/takeoff/scanOverlay';
import type { V3Point, V3Line, V3Classification } from '@/app/lib/takeoff/ai-prompt-v3';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' });

// ── Types (match existing AiScanData for client compatibility) ──────────────

export interface LineEntry { points: Array<{ x: number; y: number }> }
export interface RoofAreaEntry { name: string; points: Array<{ x: number; y: number }>; pitch_degrees: number | null }
export interface AiScanResult {
  scale: { detected: boolean; ratio: string | null; dimension_line: { p1: { x: number; y: number }; p2: { x: number; y: number }; real_length: number; unit: string } | null };
  pitch: { detected: boolean; global_degrees: number | null };
  roof_areas: RoofAreaEntry[];
  components: {
    ridges: LineEntry[]; hips: LineEntry[]; valleys: LineEntry[];
    broken_hips: LineEntry[]; barges: LineEntry[]; spouting: LineEntry[];
    uncertain: LineEntry[];
  };
  notes: string[];
  error?: string;
}

export function emptyComponents(): AiScanResult['components'] {
  return { ridges: [], hips: [], valleys: [], broken_hips: [], barges: [], spouting: [], uncertain: [] };
}

export function scalePoint(point: { x: number; y: number }, scaleX: number, scaleY: number) {
  return { x: Math.round(point.x * scaleX), y: Math.round(point.y * scaleY) };
}

export function scaleResult(result: AiScanResult, scaleX: number, scaleY: number): AiScanResult {
  const scaleLine = (entry: LineEntry): LineEntry => ({
    points: entry.points.map(p => scalePoint(p, scaleX, scaleY)),
  });
  return {
    ...result,
    roof_areas: result.roof_areas.map(area => ({
      ...area,
      points: area.points.map(p => scalePoint(p, scaleX, scaleY)),
    })),
    components: {
      ridges: result.components.ridges.map(scaleLine),
      hips: result.components.hips.map(scaleLine),
      valleys: result.components.valleys.map(scaleLine),
      broken_hips: result.components.broken_hips.map(scaleLine),
      barges: result.components.barges.map(scaleLine),
      spouting: result.components.spouting.map(scaleLine),
      uncertain: result.components.uncertain.map(scaleLine),
    },
  };
}

// ── Vision call helper ───────────────────────────────────────────────────────

export async function callVisionModel(
  prompt: string,
  images: Array<{ dataUrl: string; label?: string; detail?: 'high' | 'low' }>,
  schema: Record<string, unknown>,
  model: string,
  options: { reasoningEffort?: 'low' | 'medium' | 'high'; maxCompletionTokens: number },
): Promise<{ parsed: unknown; responseId: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number; reasoningTokens: number | null } | null }> {
  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
  ];
  for (const img of images) {
    if (img.label) {
      contentParts.push({ type: 'text', text: img.label });
    }
    contentParts.push({
      type: 'image_url',
      image_url: { url: img.dataUrl, detail: img.detail ?? 'high' },
    });
  }

  // reasoning_effort is only supported by o-series and GPT-5.x/6.x models.
  // GPT-4.1 / 4o don't accept this parameter.
  const supportsReasoningEffort = /^o\d|^gpt-[56]/i.test(model);
  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    max_completion_tokens: options.maxCompletionTokens,
    messages: [{ role: 'user', content: contentParts }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'roof_plan_analysis',
        strict: true,
        schema,
      },
    },
  };
  if (supportsReasoningEffort && options.reasoningEffort) {
    createParams.reasoning_effort = options.reasoningEffort;
  }

  const response = await openai.chat.completions.create(createParams);

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI returned an empty response.');

  return {
    parsed: JSON.parse(content),
    responseId: response.id ?? null,
    usage: response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      reasoningTokens: response.usage.completion_tokens_details?.reasoning_tokens ?? null,
    } : null,
  };
}

// ── Image preprocessing ──────────────────────────────────────────────────────

const MAX_OUTPUT_PX = 2000;

export async function preprocessImage(rawBuffer: Buffer): Promise<Buffer> {
  let pipeline = sharp(rawBuffer).rotate();
  const metadata = await pipeline.metadata();
  const longestSide = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  if (longestSide > MAX_OUTPUT_PX) {
    pipeline = pipeline.resize({
      width: MAX_OUTPUT_PX,
      height: MAX_OUTPUT_PX,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return pipeline.png({ compressionLevel: 8 }).toBuffer();
}

// ── Polygon validation ───────────────────────────────────────────────────────

export interface PolygonValidation {
  valid: boolean;
  cleanedPoints: V3Point[];
  errors: string[];
}

/**
 * Validate and clean a polygon array from AI output.
 * - Filters non-finite/out-of-bounds points
 * - Removes consecutive duplicate points
 * - Removes zero-length edges
 * - Handles explicit closure (first === last) by dropping the duplicate
 * - Requires at least 4 unique vertices for a meaningful polygon
 */
export function validatePolygon(rawPoints: unknown[], imgW: number, imgH: number): PolygonValidation {
  const errors: string[] = [];

  // Parse and filter points
  const parsed: V3Point[] = [];
  for (const p of rawPoints) {
    if (typeof p !== 'object' || p === null) { errors.push('Non-object point rejected'); continue; }
    const obj = p as Record<string, unknown>;
    const x = typeof obj.x === 'number' ? Math.round(obj.x) : NaN;
    const y = typeof obj.y === 'number' ? Math.round(obj.y) : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) { errors.push('Non-finite point rejected'); continue; }
    // Clamp to image bounds with small tolerance
    const clampedX = Math.max(0, Math.min(x, imgW - 1));
    const clampedY = Math.max(0, Math.min(y, imgH - 1));
    parsed.push({ x: clampedX, y: clampedY });
  }

  // Remove consecutive duplicate points
  const deduped: V3Point[] = [];
  for (const p of parsed) {
    const last = deduped[deduped.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) {
      deduped.push(p);
    }
  }
  // Remove explicit closure point (first === last)
  if (deduped.length >= 2 && deduped[0].x === deduped[deduped.length - 1].x && deduped[0].y === deduped[deduped.length - 1].y) {
    deduped.pop();
  }
  // Remove zero-length edges (consecutive points that are the same after dedup)
  const cleaned: V3Point[] = [];
  for (const p of deduped) {
    const last = cleaned[cleaned.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) {
      cleaned.push(p);
    }
  }

  // Check for self-intersection (simple O(n²) segment crossing test)
  function segmentsIntersect(a1: V3Point, a2: V3Point, b1: V3Point, b2: V3Point): boolean {
    const d1 = (a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x);
    const d2 = (a2.x - a1.x) * (b2.y - a1.y) - (a2.y - a1.y) * (b2.x - a1.x);
    const d3 = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
    const d4 = (b2.x - b1.x) * (a2.y - b1.y) - (b2.y - b1.y) * (a2.x - b1.x);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  let hasSelfIntersection = false;
  for (let i = 0; i < cleaned.length; i++) {
    const a1 = cleaned[i];
    const a2 = cleaned[(i + 1) % cleaned.length];
    for (let j = i + 2; j < cleaned.length; j++) {
      // Skip adjacent edges and the wrap-around edge
      if (j === cleaned.length - 1 && i === 0) continue;
      if (j === i + 1) continue;
      const b1 = cleaned[j];
      const b2 = cleaned[(j + 1) % cleaned.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        hasSelfIntersection = true;
        break;
      }
    }
    if (hasSelfIntersection) break;
  }
  if (hasSelfIntersection) {
    errors.push('Polygon self-intersection detected');
  }

  // Need at least 4 unique vertices for a meaningful roof outline
  const uniqueCount = new Set(cleaned.map(p => `${p.x},${p.y}`)).size;
  if (uniqueCount < 4) {
    errors.push(`Polygon has only ${uniqueCount} unique vertices (need >= 4)`);
    return { valid: false, cleanedPoints: cleaned, errors };
  }

  const valid = errors.filter(e => e.includes('self-intersection')).length === 0;
  return { valid, cleanedPoints: cleaned, errors: errors.length ? errors : [] };
}

// ── Angle snapping (deterministic post-Scan 2) ───────────────────────────────

const ANGLE_TOLERANCE = 5; // degrees - lines within this of 0/45/90/135 are snapped (matches prompt ±5°)
const ALLOWED_ANGLES = [0, 45, 90, 135];

function lineAngle(start: V3Point, end: V3Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return 0;
  let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

function nearestAllowedAngle(angle: number): number | null {
  let best: number | null = null;
  let bestDiff = 360;
  for (const allowed of ALLOWED_ANGLES) {
    for (const candidate of [allowed, (allowed + 180) % 360]) {
      let diff = Math.abs(angle - candidate);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate % 180;
      }
    }
  }
  return bestDiff <= ANGLE_TOLERANCE ? best : null;
}

// Snap is cosmetic cleanup for small model jitter. It must never move an
// endpoint far enough to change network topology (10-15px tolerances), so a
// snapped result is only accepted when both endpoints stay within this bound.
const MAX_SNAP_ENDPOINT_MOVEMENT_PX = 8;

function snapLineToAngle(line: V3Line): V3Line {
  const angle = lineAngle(line.start, line.end);
  const targetAngle = nearestAllowedAngle(angle);
  if (targetAngle === null) return line;

  const midX = (line.start.x + line.end.x) / 2;
  const midY = (line.start.y + line.end.y) / 2;
  const length = Math.sqrt((line.end.x - line.start.x) ** 2 + (line.end.y - line.start.y) ** 2);
  const halfLen = length / 2;
  const rad = targetAngle * Math.PI / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);

  const snappedStart = { x: Math.round(midX - dx * halfLen), y: Math.round(midY - dy * halfLen) };
  const snappedEnd = { x: Math.round(midX + dx * halfLen), y: Math.round(midY + dy * halfLen) };

  // Endpoint-movement guard: long lines with a small angular correction can
  // otherwise shift endpoints by 20-35px, silently breaking vertex matching
  // and junction connectivity. Fall back to the model's original geometry.
  const startMoved = Math.hypot(snappedStart.x - line.start.x, snappedStart.y - line.start.y);
  const endMoved = Math.hypot(snappedEnd.x - line.end.x, snappedEnd.y - line.end.y);
  if (startMoved > MAX_SNAP_ENDPOINT_MOVEMENT_PX || endMoved > MAX_SNAP_ENDPOINT_MOVEMENT_PX) {
    return line;
  }

  return {
    ...line,
    start: snappedStart,
    end: snappedEnd,
  };
}

export function filterAngleValid(lines: V3Line[]): { valid: V3Line[]; rejected: V3Line[] } {
  // Keep snap for near-canonical lines, but accept ALL angles (no hard reject).
  // Previously rejected lines >5° from 0/45/90/135, which silently dropped broken hips.
  const valid: V3Line[] = [];
  const rejected: V3Line[] = [];
  for (const line of lines) {
    const angle = lineAngle(line.start, line.end);
    const target = nearestAllowedAngle(angle);
    if (target !== null) {
      valid.push(snapLineToAngle(line));
    } else {
      // Non-canonical angle - keep the line as-is, don't reject it
      valid.push(line);
    }
  }
  return { valid, rejected };
}

// ── Collinear split merge (deterministic, post-Scan 3) ───────────────────────
// Two collinear segments meeting at a point where no other real line
// terminates is an artificial junction (typically created by a dotted plan
// line that Scan 2 treated as a break). Merge them back into one segment
// and unify their classification. Genuine hip/valley changeovers always
// happen at a real network junction (e.g. a ridge crossing), which this
// rule deliberately leaves alone.

const MERGE_ENDPOINT_TOLERANCE = 12;
const MERGE_COLLINEAR_TOLERANCE = 3; // degrees

export function mergeCollinearSplitLines(
  lines: V3Line[],
  outlinePoints: V3Point[],
  classifications: Array<{ line_id: string; type: string; confidence: number; reason: string }>,
): { lines: V3Line[]; classifications: Array<{ line_id: string; type: string; confidence: number; reason: string }>; merges: Array<{ kept: string; removed: string }> } {
  let currentLines = lines.filter(l => !l.id.startsWith('E'));
  const edgeLines = lines.filter(l => l.id.startsWith('E'));
  let currentClass = classifications.map(c => ({ ...c }));
  const merges: Array<{ kept: string; removed: string }> = [];

  const classMap = () => new Map(currentClass.map(c => [c.line_id, c]));

  const rank = (type: string): number => {
    if (type === 'hip' || type === 'valley') return 3;
    if (type === 'ridge') return 2;
    if (type === 'uncertain') return 0;
    return 1;
  };

  const dist = (a: V3Point, b: V3Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const dirOf = (l: V3Line) => {
    const dx = l.end.x - l.start.x;
    const dy = l.end.y - l.start.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };
  const angleBetween = (a: V3Line, b: V3Line) => {
    const da = dirOf(a);
    const db = dirOf(b);
    const dot = Math.max(-1, Math.min(1, da.x * db.x + da.y * db.y));
    const directed = Math.acos(dot) * 180 / Math.PI;
    // Undirected: a segment has no semantic direction, and the far-endpoint
    // continuation check already proves opposite extension, so compare the
    // acute line angle (0..90) regardless of stored start/end ordering.
    return Math.min(directed, 180 - directed);
  };

  const nearOutline = (p: V3Point): boolean => {
    for (let i = 0; i < outlinePoints.length; i++) {
      if (pointToSegmentDistance(p, outlinePoints[i], outlinePoints[(i + 1) % outlinePoints.length]) <= MERGE_ENDPOINT_TOLERANCE) return true;
    }
    return false;
  };

  let merged = true;
  while (merged) {
    merged = false;
    const cmap = classMap();

    outer: for (let i = 0; i < currentLines.length; i++) {
      for (let j = i + 1; j < currentLines.length; j++) {
        const a = currentLines[i];
        bCandidate: for (const [ai, bi] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
          const pa = ai === 0 ? a.start : a.end;
          const B = currentLines[j];
          const pb = bi === 0 ? B.start : B.end;
          if (dist(pa, pb) > MERGE_ENDPOINT_TOLERANCE) continue bCandidate;

          // Continuation check: far endpoints must be on opposite sides of the shared point
          const farA = ai === 0 ? a.end : a.start;
          const farB = bi === 0 ? B.end : B.start;
          const vA = { x: farA.x - pa.x, y: farA.y - pa.y };
          const vB = { x: farB.x - pb.x, y: farB.y - pb.y };
          const lenA = Math.hypot(vA.x, vA.y) || 1;
          const lenB = Math.hypot(vB.x, vB.y) || 1;
          const dot = (vA.x * vB.x + vA.y * vB.y) / (lenA * lenB);
          if (dot > -0.9985) continue bCandidate; // not a straight continuation

          if (angleBetween(a, B) > MERGE_COLLINEAR_TOLERANCE) continue bCandidate;
          if (nearOutline(pa)) continue bCandidate;

          // Degree check: no other non-uncertain line endpoint at this junction
          const clsB = cmap.get(B.id);
          const clsA = cmap.get(a.id);
          if (!clsA || !clsB) continue bCandidate;
          const othersAtJunction = currentLines.some(other => {
            if (other.id === a.id || other.id === B.id) return false;
            const oc = cmap.get(other.id);
            if (oc && oc.type === 'uncertain') return false;
            return dist(other.start, pa) <= MERGE_ENDPOINT_TOLERANCE || dist(other.end, pa) <= MERGE_ENDPOINT_TOLERANCE;
          });
          if (othersAtJunction) continue bCandidate;

          // Merge: keep `a`, extend to B's far endpoint
          const newA: V3Line = {
            ...a,
            start: farA,
            end: farB,
            confidence: Math.min(a.confidence, B.confidence),
          };
          currentLines = currentLines.map(l => (l.id === a.id ? newA : l)).filter(l => l.id !== B.id);

          // Unify classification: keep the higher-rank (hip/valley first), tie-break confidence
          const keepA = rank(clsA.type) > rank(clsB.type) || (rank(clsA.type) === rank(clsB.type) && clsA.confidence >= clsB.confidence);
          const keptClass = keepA ? clsA : clsB;
          currentClass = currentClass
            .filter(c => c.line_id !== a.id && c.line_id !== B.id)
            .concat([{ ...keptClass, line_id: a.id, reason: `${keptClass.reason} [collinear merge of ${a.id}+${B.id}]` }]);

          merges.push({ kept: a.id, removed: B.id });
          merged = true;
          break outer;
        }
      }
    }
  }

  return { lines: [...currentLines, ...edgeLines], classifications: currentClass, merges };
}

// ── Connectivity validation ──────────────────────────────────────────────────

function pointToSegmentDistance(p: V3Point, a: V3Point, b: V3Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

export function validateConnectivity(
  lines: V3Line[],
  outlinePoints: V3Point[],
  tolerance = 10,
): { connected: V3Line[]; floating: V3Line[] } {
  const connected: V3Line[] = [];
  const floating: V3Line[] = [];

  const endpoints: Array<{ x: number; y: number; lineId: string; isStart: boolean }> = [];
  for (const line of lines) {
    endpoints.push({ x: line.start.x, y: line.start.y, lineId: line.id, isStart: true });
    endpoints.push({ x: line.end.x, y: line.end.y, lineId: line.id, isStart: false });
  }

  function pointNearOutline(p: V3Point): boolean {
    for (let i = 0; i < outlinePoints.length; i++) {
      const a = outlinePoints[i];
      const b = outlinePoints[(i + 1) % outlinePoints.length];
      if (pointToSegmentDistance(p, a, b) <= tolerance) return true;
    }
    return false;
  }

  function pointNearOtherEndpoint(p: V3Point, ownLineId: string, ownIsStart: boolean): boolean {
    for (const ep of endpoints) {
      if (ep.lineId === ownLineId && ep.isStart === ownIsStart) continue;
      if (Math.sqrt((ep.x - p.x) ** 2 + (ep.y - p.y) ** 2) <= tolerance) return true;
    }
    return false;
  }

  // T-junction awareness: an endpoint touching the BODY of another line counts
  // as connected (same topology definition the micro-cluster filter trusts).
  // Without this, a legitimate spur meeting the middle of a ridge is dropped
  // as "floating" before later passes can protect it.
  function pointNearOtherLineSegment(p: V3Point, ownLineId: string): boolean {
    for (const other of lines) {
      if (other.id === ownLineId) continue;
      if (pointToSegmentDistance(p, other.start, other.end) <= tolerance) return true;
    }
    return false;
  }

  for (const line of lines) {
    const startConnected = pointNearOutline(line.start) || pointNearOtherEndpoint(line.start, line.id, true) || pointNearOtherLineSegment(line.start, line.id);
    const endConnected = pointNearOutline(line.end) || pointNearOtherEndpoint(line.end, line.id, false) || pointNearOtherLineSegment(line.end, line.id);
    if (startConnected || endConnected) {
      connected.push(line);
    } else {
      floating.push(line);
    }
  }

  return { connected, floating };
}

// ── Convert classifications → AiScanResult components ───────────────────────

export function classificationsToComponents(
  lines: V3Line[],
  outlinePoints: V3Point[],
  classifications: V3Classification[],
): AiScanResult['components'] {
  const components = emptyComponents();
  const lineMap = new Map<string, V3Line>();
  for (const l of lines) lineMap.set(l.id, l);

  const edgeLines = outlineToEdgeLines(outlinePoints);
  for (const e of edgeLines) lineMap.set(e.id, e);

  for (const c of classifications) {
    const line = lineMap.get(c.line_id);
    if (!line) continue;

    const lineEntry: LineEntry = {
      points: [{ x: line.start.x, y: line.start.y }, { x: line.end.x, y: line.end.y }],
    };

    switch (c.type) {
      case 'ridge': components.ridges.push(lineEntry); break;
      case 'hip': components.hips.push(lineEntry); break;
      case 'valley': components.valleys.push(lineEntry); break;
      case 'broken_hip': components.broken_hips.push(lineEntry); break;
      case 'broken_barge': components.barges.push(lineEntry); break;
      case 'barge': components.barges.push(lineEntry); break;
      case 'spouting': components.spouting.push(lineEntry); break;
      case 'uncertain': components.uncertain.push(lineEntry); break;
    }
  }

  return components;
}
