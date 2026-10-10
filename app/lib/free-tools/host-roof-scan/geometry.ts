/** Reuse the existing precision engine; add strict validation at the host boundary. */
import { polygonArea, polygonPerimeter, validateOutline } from '../../takeoff/precision/precisionGeometry';
import { applyAffine } from '../../takeoff/calibrationCoordinates';
import type { Vertex, EditableGeometry } from '../../takeoff/precision/precisionTypes';
import type { Calibration, ImageFrame, Point, RoofOutline } from './types';
import { LIMITS, ScanError } from './types';
export function object(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new ScanError('INVALID_INPUT', `${label} must be an object.`);
    return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 200): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max)
        throw new ScanError('INVALID_INPUT', `${label} must be nonempty text, at most ${max} characters.`);
    return value.trim();
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
    if (Object.keys(value).some(k => !allowed.includes(k)))
        throw new ScanError('INVALID_INPUT', 'Unrecognised fields. Use the supplied schema.');
}
export function point(value: unknown, frame: Pick<ImageFrame, 'width' | 'height'>): Point {
    const p = object(value, 'Point');
    keys(p, ['x', 'y']);
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y))
        throw new ScanError('INVALID_GEOMETRY', 'Coordinates must be finite numbers.');
    if (p.x < 0 || p.y < 0 || p.x > frame.width - 1 || p.y > frame.height - 1)
        throw new ScanError('OUT_OF_BOUNDS', 'Coordinates are outside the prepared image. Do not submit viewport, resized or guessed coordinates.');
    return { x: p.x, y: p.y };
}
export function asVertices(points: readonly Point[]): Vertex[] {
    return points.map((p, i) => ({ id: `v${i}`, point: { ...p } }));
}
function onSegment(p: Point, a: Point, b: Point): boolean {
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    return Math.abs(cross) < 1e-7 && p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7 && p.y >= Math.min(a.y, b.y) - 1e-7 && p.y <= Math.max(a.y, b.y) + 1e-7;
}
export function validatePoints(raw: unknown, frame: Pick<ImageFrame, 'width' | 'height'>): Point[] {
    if (!Array.isArray(raw) || raw.length < 3 || raw.length > LIMITS.vertices)
        throw new ScanError('INVALID_GEOMETRY', `Provide 3 to ${LIMITS.vertices} distinct perimeter vertices.`);
    const points = raw.map(p => point(p, frame));
    const vertices = asVertices(points);
    const draft: EditableGeometry = {
        target: { kind: 'outline', geometryId: 'host-review-only', quoteRoofAreaId: null, origin: 'imported' },
        context: { quoteId: 'host-review-only', pageId: 'host-review-only', imageRevision: null, coordinateFrame: 'takeoff-scene-v1', sessionVersion: 0, contextEpoch: 0 },
        vertices, closed: true, localGeometryRevision: 0,
    };
    const problems = validateOutline(draft, { sceneWidth: frame.width, sceneHeight: frame.height }).filter(p => p.severity === 'blocking');
    if (problems.length)
        throw new ScanError('INVALID_GEOMETRY', problems.map(p => p.message).join(' '));
    // The shared engine permits joints; the external boundary also rejects nonadjacent T-touches.
    for (let i = 0; i < points.length; i++)
        for (let j = 0; j < points.length; j++) {
            if (i === j || i === (j + 1) % points.length)
                continue;
            if (onSegment(points[i], points[j], points[(j + 1) % points.length]))
                throw new ScanError('SELF_TOUCH', 'The outline touches or doubles back onto itself. Correct the vertices.');
        }
    if (polygonArea(vertices) < 4)
        throw new ScanError('INVALID_GEOMETRY', 'The outline encloses less than four square pixels.');
    // Do not snap, clamp, round, simplify or silently remove genuine roof details.
    return points;
}
export function parseOutline(value: unknown, frame: Pick<ImageFrame, 'width' | 'height'>): RoofOutline {
    const o = object(value, 'Roof outline');
    keys(o, ['name', 'points', 'pitch_degrees']);
    if (o.pitch_degrees !== null)
        throw new ScanError('PITCH_NOT_SUPPORTED', 'Phase 1 traces the footprint only. pitch_degrees must be null; do not infer pitch from the plan.');
    return { name: text(o.name, 'Roof name', 80), points: validatePoints(o.points, frame), pitch_degrees: null };
}
export function parseCalibration(value: unknown, frame: Pick<ImageFrame, 'width' | 'height'>): Calibration | null {
    if (value === null || value === undefined)
        return null;
    const c = object(value, 'Calibration');
    keys(c, ['start', 'end', 'realLength', 'unit']);
    const start = point(c.start, frame), end = point(c.end, frame);
    if (Math.hypot(end.x - start.x, end.y - start.y) < 10)
        throw new ScanError('INVALID_CALIBRATION', 'Select a reference at least 10 pixels long.');
    if (typeof c.realLength !== 'number' || !Number.isFinite(c.realLength) || c.realLength <= 0 || c.realLength > 10000 || !['m', 'ft'].includes(String(c.unit)))
        throw new ScanError('INVALID_CALIBRATION', 'Enter a positive known length, up to 10,000, in metres or feet.');
    return { start, end, realLength: c.realLength, unit: c.unit as 'm' | 'ft' };
}
export function measurements(points: readonly Point[], calibration: Calibration | null) {
    if (!calibration)
        return null;
    const unitsPerPixel = calibration.realLength / Math.hypot(calibration.end.x - calibration.start.x, calibration.end.y - calibration.start.y);
    return {
        basis: 'plan_projection_only',
        unit: calibration.unit,
        area: polygonArea(asVertices(points)) * unitsPerPixel * unitsPerPixel,
        perimeter: polygonPerimeter(asVertices(points), true) * unitsPerPixel,
        areaUnit: calibration.unit === 'm' ? 'm2' : 'ft2',
        pitchApplied: false,
        warning: 'Reference length and roof outline were supplied or reviewed by the user. This is plan area, not pitched roof surface area or gutter length.',
    };
}
/** Explicit same-orientation affine mapping. Never treat analysis pixels as viewport pixels. */
export function toSceneScanData(outline: RoofOutline, frame: Pick<ImageFrame, 'width' | 'height'>, scene: {
    width: number;
    height: number;
}) {
    if (!Number.isFinite(scene.width) || !Number.isFinite(scene.height) || scene.width <= 0 || scene.height <= 0)
        throw new ScanError('INVALID_SCENE', 'Scene dimensions must be positive.');
    const sx = scene.width / frame.width, sy = scene.height / frame.height;
    if (Math.abs(sx - sy) > Math.max(sx, sy) * 0.003)
        throw new ScanError('ASPECT_MISMATCH', 'The target scene is not the same uncropped image. Explicit crop/rotation mapping is required.');
    return { roof_areas: [{ ...outline, points: outline.points.map(p => applyAffine([sx, 0, 0, sy, 0, 0], p)) }], notes: ['Host-model outline, reviewed by a user. Components and pitch were not inferred.'] };
}
