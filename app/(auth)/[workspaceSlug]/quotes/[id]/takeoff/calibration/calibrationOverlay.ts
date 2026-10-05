// Read-only Fabric overlay for calibration candidate review (spec 4.2, P2 task 7).
// Renders the WHOLE current candidate set with selection/decision state, using
// explicit centre origins so marker centres sit exactly on scene endpoints.
// Objects are tagged with a session-scoped role and cleaned up by tag/object
// reference - never by colour. Preview objects are non-editing, selectable false,
// excluded from history/exports (the workstation snapshots never include them
// because they are removed before any state capture and never added to
// measurement records). NO changes to global Fabric defaults.
import { Circle, Line, Text, type Canvas, type FabricObject } from 'fabric';
import type { CalibrationCandidate, CandidateReview } from '@/app/lib/takeoff/calibrationTypes';

/** Tag applied to every object this module adds (custom property, not colour). */
export const CALIBRATION_OVERLAY_TAG = '__aiCalibrationPreview';

export interface OverlayRenderInput {
  candidates: readonly CalibrationCandidate[];
  activeCandidateId: string | null;
  reviews: Record<string, CandidateReview>;
  /** Candidate ids that currently appear in the accepted set. */
  acceptedCandidateIds: ReadonlySet<string>;
}

interface Style {
  stroke: string;
  strokeWidth: number;
  markerRadius: number;
  markerStrokeWidth: number;
  dash: number[] | undefined;
  opacity: number;
  /** Candidate number label styling (audit Section 7, UX-1). */
  labelFill: string;
  labelFontSize: number;
  labelOpacity: number;
}

const ACTIVE: Style = {
  stroke: '#2563eb',
  strokeWidth: 4,
  markerRadius: 10,
  markerStrokeWidth: 4,
  dash: undefined,
  opacity: 1,
  labelFill: '#2563eb',
  labelFontSize: 16,
  labelOpacity: 1,
};
// Owner UX feedback 2026-09-20: the selected tab's candidate must dominate -
// non-selected unreviewed candidates dim to ~30% so the bright active line
// and markers are unmistakable on the canvas.
const PASSIVE: Style = {
  stroke: '#94a3b8',
  strokeWidth: 2,
  markerRadius: 6,
  markerStrokeWidth: 2,
  dash: [8, 6],
  opacity: 0.3,
  labelFill: '#64748b',
  labelFontSize: 13,
  labelOpacity: 0.3,
};
const ACCEPTED: Style = {
  stroke: '#059669',
  strokeWidth: 2.5,
  markerRadius: 8,
  markerStrokeWidth: 2.5,
  dash: undefined,
  opacity: 0.95,
  labelFill: '#059669',
  labelFontSize: 14,
  labelOpacity: 1,
};
const SKIPPED: Style = {
  stroke: '#cbd5e1',
  strokeWidth: 1.5,
  markerRadius: 5,
  markerStrokeWidth: 1.5,
  dash: [3, 5],
  opacity: 0.45,
  labelFill: '#94a3b8',
  labelFontSize: 12,
  labelOpacity: 0.35,
};

function styleFor(candidateId: string, input: OverlayRenderInput): Style {
  if (input.acceptedCandidateIds.has(candidateId)) return ACCEPTED;
  const decision = input.reviews[candidateId]?.decision;
  if (decision === 'skipped') return SKIPPED;
  if (candidateId === input.activeCandidateId) return ACTIVE;
  return PASSIVE;
}

function makeTagged(obj: FabricObject): FabricObject {
  (obj as FabricObject & Record<string, unknown>)[CALIBRATION_OVERLAY_TAG] = true;
  obj.selectable = false;
  obj.evented = false;
  obj.excludeFromExport = true;
  return obj;
}

/** Remove every calibration preview object from the canvas (by tag, not colour). */
export function disposeCalibrationOverlay(canvas: Canvas | null): void {
  if (!canvas) return;
  const doomed = canvas.getObjects().filter(
    (o) => (o as FabricObject & Record<string, unknown>)[CALIBRATION_OVERLAY_TAG] === true,
  );
  for (const obj of doomed) canvas.remove(obj);
  canvas.requestRenderAll();
}

/**
 * Render the entire candidate set + selection state. Disposes previous preview
 * objects first. Each candidate draws one line (scene endpoints) and two centre
 * crosshair rings (originX/originY 'center' so the marker centre IS the endpoint).
 */
export function renderCalibrationOverlay(
  canvas: Canvas | null,
  input: OverlayRenderInput,
): void {
  if (!canvas) return;
  disposeCalibrationOverlay(canvas);

  input.candidates.forEach((c, candidateIndex) => {
    const style = styleFor(c.id, input);
    const line = makeTagged(
      new Line(
        [c.sceneP1.x, c.sceneP1.y, c.sceneP2.x, c.sceneP2.y],
        {
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDashArray: style.dash,
          opacity: style.opacity,
          originX: 'center',
          originY: 'center',
        },
      ),
    );
    canvas.add(line);
    for (const p of [c.sceneP1, c.sceneP2]) {
      const ring = makeTagged(
        new Circle({
          left: p.x,
          top: p.y,
          radius: style.markerRadius,
          fill: 'rgba(255,255,255,0.35)',
          stroke: style.stroke,
          strokeWidth: style.markerStrokeWidth,
          originX: 'center',
          originY: 'center',
          opacity: style.opacity,
        }),
      );
      canvas.add(ring);
      // Precise centre crosshair: two tiny strokes through the exact endpoint.
      const cross1 = makeTagged(
        new Line([p.x - style.markerRadius, p.y, p.x + style.markerRadius, p.y], {
          stroke: style.stroke,
          strokeWidth: 1,
          opacity: style.opacity,
          originX: 'center',
          originY: 'center',
        }),
      );
      const cross2 = makeTagged(
        new Line([p.x, p.y - style.markerRadius, p.x, p.y + style.markerRadius], {
          stroke: style.stroke,
          strokeWidth: 1,
          opacity: style.opacity,
          originX: 'center',
          originY: 'center',
        }),
      );
      canvas.add(cross1);
      canvas.add(cross2);
    }

    // Candidate number label (UX-1): matches the review panel's 1/2/3 badges.
    // Drawn above the line midpoint, styled with the same state palette.
    const midX = (c.sceneP1.x + c.sceneP2.x) / 2;
    const midY = (c.sceneP1.y + c.sceneP2.y) / 2;
    const label = makeTagged(
      new Text(String(candidateIndex + 1), {
        left: midX,
        top: midY - style.markerRadius - 14,
        fill: style.labelFill,
        fontSize: style.labelFontSize,
        fontWeight: 'bold',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        originX: 'center',
        originY: 'bottom',
        opacity: style.labelOpacity,
      }),
    );
    canvas.add(label);
  });
  canvas.requestRenderAll();
}
