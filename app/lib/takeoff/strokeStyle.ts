// ── Stroke-style classification (deterministic, sharp-only) ────────────
// Runs IMMEDIATELY after Scan 2 parse, BEFORE angle snapping, connectivity
// checks, overlay generation and Scan 3. Dotted/dashed plan lines are never
// roof components, so high-confidence dashed candidates are removed before
// they can poison topology (false junctions, split valleys/ridges) or be
// redrawn as solid orange lines in the Scan 3 overlays.
//
// Evidence-based decision (not duty-cycle-only): samples a narrow centre
// band along the candidate, converts to a binary ink/gap sequence, removes
// anti-aliasing noise, then decides from run/gap statistics.

import sharp from 'sharp';
import type { V3Line } from './ai-prompt-v3';

export type StrokeStyle = 'solid' | 'dashed' | 'ambiguous';

export interface StrokeEvidence {
  lineId: string;
  style: StrokeStyle;
  dutyCycle: number;
  inkRuns: number;
  gapRuns: number;
  longestGapPx: number;
  medianGapPx: number | null;
  gapRegularity: number | null; // coefficient of variation of gap lengths (lower = more regular)
  longestInkPx: number;
}

// ── Thresholds (named, tune against the golden plan set - do not inline) ──
const STROKE_CENTRE_BAND_OFFSETS = [-2, -1, 0, 1, 2]; // narrow centre band (was ±4 wide min-band)
const STROKE_INK_LUMINANCE = 135; // below this = ink
const STROKE_MIN_LINE_LENGTH = 12; // shorter candidates cannot be judged reliably
const STROKE_SAMPLE_STEP_PX = 2; // sampling spacing along the stroke
const STROKE_MIN_SAMPLES = 20;
const STROKE_MAX_SAMPLES = 500;
const NOISE_RUN_LENGTH = 1; // ink/gap runs of this many samples are anti-aliasing noise

const DASHED_DUTY_CYCLE_MAX = 0.72; // duty cycle at or below this can be dashed
const DASHED_MIN_GAP_RUNS = 2; // repeated gaps required (not just one faint patch)
const DASHED_MIN_MEDIAN_GAP_SAMPLES = 2; // median gap must be at least 2 samples (~4px)
const DASHED_MIN_LONGEST_GAP_SAMPLES = 3;
const DASHED_MAX_GAP_CV = 1.5; // gaps should be somewhat regular (dashes, not random noise)

const AMBIGUOUS_DUTY_CYCLE_MAX = 0.85; // borderline faint/broken strokes stay for review
export const NEAR_EMPTY_DUTY_CYCLE = 0.05; // below this the trace shows essentially no ink

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDevOverMean(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Remove 1-sample noise runs from a binary sequence (flip isolated samples). */
function denoiseSequence(seq: boolean[]): boolean[] {
  const out = [...seq];
  for (let i = 0; i < out.length; i++) {
    const prev = i > 0 ? out[i - 1] : out[i];
    const next = i < out.length - 1 ? out[i + 1] : out[i];
    if (out[i] !== prev && out[i] !== next) out[i] = prev; // isolated sample -> match neighbours
  }
  return out;
}

function runLengths(seq: boolean[], value: boolean): number[] {
  const runs: number[] = [];
  let count = 0;
  for (const v of seq) {
    if (v === value) {
      count++;
    } else if (count > 0) {
      runs.push(count);
      count = 0;
    }
  }
  if (count > 0) runs.push(count);
  return runs.filter(r => r > NOISE_RUN_LENGTH);
}

/**
 * Classify the stroke style of each candidate line against the processed image.
 * Never throws - on raster failure returns an empty map (callers keep all lines).
 */
export async function classifyCandidateStrokeStyles(
  processedBuffer: Buffer,
  lines: V3Line[],
): Promise<Map<string, StrokeEvidence>> {
  const results = new Map<string, StrokeEvidence>();
  try {
    const { data, info } = await sharp(processedBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });

    for (const line of lines) {
      if (line.id.startsWith('E')) continue; // outline edges are always solid
      const vx = line.end.x - line.start.x;
      const vy = line.end.y - line.start.y;
      const len = Math.hypot(vx, vy);
      if (len < STROKE_MIN_LINE_LENGTH) continue;

      const px = -vy / len; // perpendicular unit vector
      const py = vx / len;

      // Ink at a sample point: the darkest pixel in the NARROW centre band.
      const inkAt = (x: number, y: number): boolean => {
        let min = 255;
        for (const o of STROKE_CENTRE_BAND_OFFSETS) {
          const sx = Math.round(x + px * o);
          const sy = Math.round(y + py * o);
          if (sx < 0 || sy < 0 || sx >= info.width || sy >= info.height) continue;
          const v = data[sy * info.width + sx];
          if (v < min) min = v;
        }
        return min < STROKE_INK_LUMINANCE;
      };

      const n = Math.min(STROKE_MAX_SAMPLES, Math.max(STROKE_MIN_SAMPLES, Math.round(len / STROKE_SAMPLE_STEP_PX)));
      const seq: boolean[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        seq.push(inkAt(line.start.x + vx * t, line.start.y + vy * t));
      }

      const cleaned = denoiseSequence(seq);
      const inkCount = cleaned.filter(Boolean).length;
      const dutyCycle = inkCount / cleaned.length;
      const inkRuns = runLengths(cleaned, true).length;
      const gapRunsList = runLengths(cleaned, false);
      const gapRuns = gapRunsList.length;
      const longestGapPx = gapRunsList.length ? Math.max(...gapRunsList) : 0;
      const medianGapPx = median(gapRunsList);
      const gapRegularity = stdDevOverMean(gapRunsList);
      const inkRunList = runLengths(cleaned, true);
      const longestInkPx = inkRunList.length ? Math.max(...inkRunList) : 0;

      // Decision: dashed needs REPEATED, MEANINGFUL, reasonably regular gaps.
      let style: StrokeStyle = 'solid';
      if (
        gapRuns >= DASHED_MIN_GAP_RUNS &&
        dutyCycle <= DASHED_DUTY_CYCLE_MAX &&
        (medianGapPx ?? 0) >= DASHED_MIN_MEDIAN_GAP_SAMPLES &&
        longestGapPx >= DASHED_MIN_LONGEST_GAP_SAMPLES &&
        (gapRegularity === null || gapRegularity <= DASHED_MAX_GAP_CV)
      ) {
        style = 'dashed';
      } else if (gapRuns >= 1 && dutyCycle <= AMBIGUOUS_DUTY_CYCLE_MAX) {
        // Faint/broken stroke that is not confidently dashed - keep for review.
        style = 'ambiguous';
      }

      results.set(line.id, {
        lineId: line.id,
        style,
        dutyCycle: Math.round(dutyCycle * 1000) / 1000,
        inkRuns,
        gapRuns,
        longestGapPx,
        medianGapPx,
        gapRegularity: gapRegularity === null ? null : Math.round(gapRegularity * 1000) / 1000,
        longestInkPx,
      });
    }
  } catch (err) {
    console.warn('[strokeStyle] classification failed (keeping all lines):', err instanceof Error ? err.message : err);
    return new Map();
  }
  return results;
}
