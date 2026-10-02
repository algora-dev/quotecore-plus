import type { Point, RoofEdge, RoofFace } from './types';
import { EPS, fingerprint, validateRing } from './math';
import { geometricBoundary, FACE_GEOMETRY_MODEL } from './faceGeometry';

/** Screen directions: right = 0, down = 90. They are not geographic bearings. */
export const SCREEN_DIRECTIONS = [
  { angle: 270, label: 'Up', arrow: '↑' }, { angle: 0, label: 'Right', arrow: '→' },
  { angle: 90, label: 'Down', arrow: '↓' }, { angle: 180, label: 'Left', arrow: '←' },
] as const;
export function hasFlow(flow: Point | null | undefined): flow is Point {
  return !!flow && Number.isFinite(flow.x) && Number.isFinite(flow.y) && Math.hypot(flow.x, flow.y) > EPS;
}
export function flowAngle(flow: Point | null | undefined): number | null {
  return hasFlow(flow) ? ((Math.atan2(flow.y, flow.x) * 180 / Math.PI) % 360 + 360) % 360 : null;
}
export function flowFromAngle(angle: number): Point {
  if (!Number.isFinite(angle)) throw new Error('Enter a finite water direction.');
  const a = ((angle % 360) + 360) % 360 * Math.PI / 180;
  return { x: Math.abs(Math.cos(a)) < 1e-12 ? 0 : Math.cos(a), y: Math.abs(Math.sin(a)) < 1e-12 ? 0 : Math.sin(a) };
}
/** Missing starts at Up; subsequent clicks advance clockwise to a preset. */
export function nextFlowAngle(flow: Point | null | undefined): number {
  const a = flowAngle(flow); return a === null ? 270 : ((Math.floor((a + 1e-7) / 90) + 1) * 90) % 360;
}
export function directionRevision(face: RoofFace): string {
  return fingerprint([FACE_GEOMETRY_MODEL, face.id, face.polygon, face.flow]);
}
export function directionApproved(face: RoofFace): boolean {
  return face.confirmed && hasFlow(face.flow) && face.directionApproval === directionRevision(face);
}
/** Confirmation is an explicit UI action, never automatic inference or a way
 * to make missing/zero vectors and corrupt polygons calculable. */
export function confirmReviewedFace(face: RoofFace): RoofFace {
  const invalid = validateRing(face.polygon);
  if (invalid) throw new Error(`${face.name}: ${invalid}`);
  if (!hasFlow(face.flow)) throw new Error(`${face.name}: choose a water direction before confirming.`);
  return { ...face, confirmed: true, directionApproval: directionRevision(face) };
}
/** Cutting roles always come from the shape and its water vector. Unknown,
 * absent or misleading catalogue names have no effect. Approval is checked
 * separately by validateInputs; deriving roles never approves a face. */
export function planningBoundary(face: RoofFace): RoofEdge[] {
  return geometricBoundary(face);
}
