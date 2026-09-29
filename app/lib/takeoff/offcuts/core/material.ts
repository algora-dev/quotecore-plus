import type { Demand, FaceFrame, Issue, Offcut, Point, Profile, RoofFace, RoofInput, SolveSettings } from './types';
import { EPS, add, dot, mul, sub, unit, validateRing } from './math';
import { area, bounds, components, extendY, fromRing, intersect, isMonotone, rectangle, subtract, translate } from './regions';
import { validatePartition } from './graph';
export function frameFor(face: RoofFace, roof: RoofInput): FaceFrame {
  if (!face.flow || face.pitchDeg === null) throw new Error(`${face.name}: confirm water direction and pitch first.`);
  const v = unit(face.flow), u = { x: v.y, y: -v.x };
  return { origin: face.polygon[0], u, v, mmPerSceneUnit: roof.mmPerSceneUnit, pitchCos: Math.cos(face.pitchDeg * Math.PI / 180) };
}
export function sceneToSurface(p: Point, f: FaceFrame): Point {
  const d = sub(p, f.origin);
  return { x: dot(d, f.u) * f.mmPerSceneUnit, y: dot(d, f.v) * f.mmPerSceneUnit / f.pitchCos };
}
export function surfaceToScene(p: Point, f: FaceFrame): Point {
  return add(f.origin, add(mul(f.u, p.x / f.mmPerSceneUnit), mul(f.v, p.y * f.pitchCos / f.mmPerSceneUnit)));
}
export function demandPointToScene(p: Point, d: Demand): Point { return surfaceToScene(add(p, d.origin), d.frame); }
export function scenePointToDemand(p: Point, d: Demand): Point { return sub(sceneToSurface(p, d.frame), d.origin); }
export function validateInputs(roof: RoofInput, faces: RoofFace[], p: Profile, settings: SolveSettings): Issue[] {
  const issues: Issue[] = validatePartition(roof, faces);
  const error = (code: string, message: string, faceId?: string): void => { issues.push({ severity: 'error', code, message, faceId }); };
  if (!roof.calibrationConfirmed || !Number.isFinite(roof.mmPerSceneUnit) || roof.mmPerSceneUnit <= 0) error('CALIBRATION', 'The active page needs a confirmed, positive calibration.');
  if (!faces.length) error('NO_FACES', 'No faces are available.');
  if (new Set(faces.map(f => f.id)).size !== faces.length) error('DUPLICATE_FACE', 'Face IDs must be unique.');
  const numbers = [p.coverMm, p.leftLapMm, p.rightLapMm, p.cutGapMm, p.endAllowanceMm, p.maxLengthMm, p.lengthIncrementMm];
  if (!numbers.every(Number.isFinite) || p.coverMm < 1 || p.coverMm > 3000 || p.leftLapMm < 0 || p.rightLapMm < 0 || p.cutGapMm < 0 || p.endAllowanceMm < 0 || p.maxLengthMm <= 0 || p.lengthIncrementMm <= 0) error('PROFILE', 'Check cover, overlaps, allowances, maximum length and length increment.');
  if (p.allowEndForEnd && Math.abs(p.leftLapMm - p.rightLapMm) > EPS) error('ASYMMETRIC_PROFILE', 'V1 end-for-end reuse requires symmetric side allowances. Asymmetric profiles need a manufacturer-specific rib/edge registration adapter.');
  if (p.allowEndForEnd && !p.rulesConfirmed) error('UNCONFIRMED_ROTATION', 'Confirm the profile rules before enabling end-for-end reuse.');
  if (![settings.maxSheets, settings.maxTrials, settings.maxMilliseconds].every(n => Number.isFinite(n) && n > 0) || settings.maxSheets > 2000 || settings.maxTrials > 64 || settings.maxMilliseconds > 30000) error('BUDGET', 'Use positive search limits: at most 2000 sheets, 64 trials and 30000 milliseconds.');
  if (!p.rulesConfirmed) issues.push({ severity: 'warning', code: 'PROFILE_UNVERIFIED', message: 'Profile/side-lap allowances are unverified. This is a geometric prototype, not an order-ready material list.' });
  for (const f of faces) {
    const invalid = validateRing(f.polygon); if (invalid) { error('FACE_POLYGON', `${f.name}: ${invalid}`, f.id); continue; }
    if (!f.confirmed) error('FACE_UNCONFIRMED', `${f.name}: review and confirm this face.`, f.id);
    if (f.pitchDeg === null || !Number.isFinite(f.pitchDeg) || f.pitchDeg < 0 || f.pitchDeg >= 80) error('PITCH', `${f.name}: enter a confirmed pitch from 0° to less than 80°. A 45° plan hip does not remove pitch from surface geometry.`, f.id);
    if (!f.flow || !Number.isFinite(f.flow.x) || !Number.isFinite(f.flow.y) || Math.hypot(f.flow.x, f.flow.y) < EPS) { error('FLOW', `${f.name}: water direction is missing.`, f.id); continue; }
    if (f.lap !== 1 && f.lap !== -1) error('LAP', `${f.name}: invalid lap direction.`, f.id);
    if (!Number.isFinite(f.laneOffsetMm) || f.laneOffsetMm < 0 || f.laneOffsetMm >= p.coverMm) error('LANE_PHASE', `${f.name}: lane offset must be at least zero and less than one effective cover.`, f.id);
    const v = unit(f.flow), u = { x: v.y, y: -v.x };
    for (const e of f.boundary) {
      const direction = unit(sub(e.b, e.a));
      if (e.kind === 'spouting' && dot(v, { x: direction.y, y: -direction.x }) < 0.99) error('FLOW_EAVE_CONFLICT', `${f.name}: the water arrow does not point outward through its spouting edge.`, f.id);
      if (e.kind === 'barge' && Math.abs(dot(v, direction)) < 0.99) error('BARGE_DIRECTION', `${f.name}: the barge does not run with the water direction.`, f.id);
      if (e.kind === 'ridge' && Math.abs(dot(v, direction)) > 0.03) error('RIDGE_DIRECTION', `${f.name}: the ridge is not across the water direction.`, f.id);
    }
    // V1 geometry is restricted to 0/45/90 degrees RELATIVE to the face,
    // not to north or the screen. Never silently snap the user's polygon.
    f.polygon.forEach((a, i) => {
      const b = f.polygon[(i + 1) % f.polygon.length], d = unit(sub(b, a));
      const angle = Math.atan2(Math.abs(dot(d, v)), Math.abs(dot(d, u))) * 180 / Math.PI;
      if (Math.min(Math.abs(angle), Math.abs(angle - 45), Math.abs(angle - 90)) > 1.5) error('UNSUPPORTED_ANGLE', `${f.name}: an edge is not 0°, 45° or 90° in the face's plan frame. Adjust it or use manual review.`, f.id);
    });
  }
  return issues;
}
export function generateDemands(roof: RoofInput, faces: RoofFace[], profile: Profile, settings: SolveSettings): Demand[] {
  const errors = validateInputs(roof, faces, profile, settings).filter(i => i.severity === 'error');
  if (errors.length) throw new Error(errors.map(i => i.message).join('\n'));
  const result: Demand[] = [], w = profile.coverMm, physicalWidth = w + profile.leftLapMm + profile.rightLapMm;
  for (const face of faces) {
    const frame = frameFor(face, roof), local = fromRing(face.polygon.map(p => sceneToSurface(p, frame))), box = bounds(local);
    if (!isMonotone(local)) throw new Error(`${face.name}: a sheet run crosses disjoint roof intervals. Split/review this face; penetrations and non-continuous runs are not supported in V1.`);
    const start = box.minX - face.laneOffsetMm, count = Math.ceil((box.maxX - start) / w - 1e-10);
    if (result.length + count > settings.maxSheets) throw new Error(`Sheet limit exceeded (${settings.maxSheets}). Check the calibration/cover or reduce the selected roof scope.`);
    for (let i = 0; i < count; i++) {
      const x = start + i * w;
      const cover = intersect(local, rectangle(x, box.minY - 1, x + w, box.maxY + 1));
      if (area(cover) < EPS) continue;
      const laneX = x - profile.leftLapMm;
      const physical = intersect(local, rectangle(laneX, box.minY - 1, laneX + physicalWidth, box.maxY + 1));
      const expanded = extendY(physical, profile.endAllowanceMm), physicalBox = bounds(expanded);
      const y = physicalBox.minY, required = translate(expanded, -laneX, -y);
      const blankY0 = settings.stockMode === 'face-envelope' ? box.minY - profile.endAllowanceMm - y : 0;
      const rawY1 = settings.stockMode === 'face-envelope' ? box.maxY + profile.endAllowanceMm - y : physicalBox.maxY - y;
      const len = Math.ceil((rawY1 - blankY0 - EPS) / profile.lengthIncrementMm) * profile.lengthIncrementMm;
      if (len > profile.maxLengthMm + EPS) throw new Error(`${face.name}, lane ${i + 1}: ${(len / 1000).toFixed(3)} m exceeds the profile maximum. V1 never inserts end laps to make it fit.`);
      result.push({ id: `${face.id}:sheet:${i + 1}`, faceId: face.id, laneIndex: i, lap: face.lap,
        widthMm: physicalWidth, origin: { x: laneX, y }, frame, required,
        cover: translate(cover, -laneX, -y), blank: rectangle(0, blankY0, physicalWidth, blankY0 + len) });
    }
  }
  return result;
}
export function offcutsFrom(d: Demand, profile: Profile): Offcut[] {
  // Longitudinal clearance beyond the installed cut belongs to waste. It is
  // never reintroduced to inventory as an apparently reusable polygon.
  const left = subtract(d.blank, extendY(d.required, profile.cutGapMm));
  return components(left).filter(r => area(r) > 1).map((region, i) => ({
    id: `${d.id}:offcut:${i + 1}`, sourceDemandId: d.id, sourceFaceId: d.faceId,
    region, widthMm: d.widthMm, lap: d.lap,
  }));
}
