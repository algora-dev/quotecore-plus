import { STOCK_END_MODEL, proposeStockEnds, originalStockDemand, sameStockData } from './stockEnds';
import type { BankLayout, Demand, FaceFrame, Issue, Offcut, Point, Profile, Region, RoofEdge, RoofFace, RoofInput, SolveSettings } from './types';
import { EPS, add, dot, mul, sub, unit, validateRing } from './math';
import { area, bounds, boundarySegments, components, extendY, fromRing, intersect, isMonotone, rectangle, subtract, translate } from './regions';
import { validatePartition } from './partition';
import { directionApproved, planningBoundary } from './directions';
import { validateFaceDirections } from './reviewGeometry';
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
  // End-for-end is a long-run planning default, NOT manufacturer approval.
  // Unverified rules remain a visible warning and every output is draft-only.
  if (![settings.maxSheets, settings.maxTrials, settings.maxMilliseconds].every(n => Number.isFinite(n) && n > 0) || settings.maxSheets > 2000 || settings.maxTrials > 64 || settings.maxMilliseconds > 30000) error('BUDGET', 'Use positive search limits: at most 2000 sheets, 64 trials and 30000 milliseconds.');
  if(settings.globalBankSearch!==undefined&&typeof settings.globalBankSearch!=='boolean')error('GLOBAL_BANK_SETTINGS','Global donor search must be enabled or disabled.');
  if(settings.globalBankMaxMilliseconds!==undefined&&(!Number.isFinite(settings.globalBankMaxMilliseconds)||settings.globalBankMaxMilliseconds<0||settings.globalBankMaxMilliseconds>12000))error('GLOBAL_BANK_BUDGET','Global donor search must be between zero and 12000 milliseconds.');
  if (settings.provisionalReuse!==undefined&&typeof settings.provisionalReuse!=='boolean') error('REPLAY_SETTINGS','Provisional reuse must be enabled or disabled.');
  if (settings.provisionalMaxMilliseconds!==undefined&&(!Number.isFinite(settings.provisionalMaxMilliseconds)||settings.provisionalMaxMilliseconds<0||settings.provisionalMaxMilliseconds>20000)) error('REPLAY_BUDGET','The extra offcut-replay budget must be between 0 and 20000 milliseconds.');
  if (!['bank-first', 'per-lane', 'face-envelope'].includes(settings.stockMode)) error('STOCK_MODE', 'Unknown sheet layout mode.');
  if (settings.maxBankExtensionMm !== undefined && (!Number.isFinite(settings.maxBankExtensionMm) || settings.maxBankExtensionMm < 0 || settings.maxBankExtensionMm > 300)) error('BANK_EXTENSION', 'Automatic extra stock must be between 0 and 300 mm.');
  if (settings.maxSourceBlocksPerFace !== undefined && (!Number.isInteger(settings.maxSourceBlocksPerFace) || settings.maxSourceBlocksPerFace < 1 || settings.maxSourceBlocksPerFace > 2)) error('SOURCE_LIMIT', 'Practical automatic plans support one or two coherent external source blocks per face.');
  if (settings.selfFillTransitionMm !== undefined && (!Number.isFinite(settings.selfFillTransitionMm) || settings.selfFillTransitionMm < 0 || settings.selfFillTransitionMm > p.coverMm)) error('SELF_FILL_MARGIN', 'Self-fill transition must be between zero and one sheet cover.');
  if(settings.receiverPhaseMode!==undefined&&!['quote-safe','fixed-registration'].includes(settings.receiverPhaseMode)) error('RECEIVER_PHASE','Choose quote-safe or fixed-registration receiver planning.');
  if(settings.receiverPhaseCoverFraction!==undefined&&(!Number.isFinite(settings.receiverPhaseCoverFraction)||settings.receiverPhaseCoverFraction<0||settings.receiverPhaseCoverFraction>1))error('RECEIVER_PHASE','Source phase band must be between zero and one sheet cover.');
  if (!p.rulesConfirmed) issues.push({ severity: 'warning', code: 'PROFILE_UNVERIFIED', message: 'Profile/side-lap allowances are unverified. This is a geometric prototype, not an order-ready material list.' });
  for (const f of faces) {
    const invalid = validateRing(f.polygon); if (invalid) { error('FACE_POLYGON', `${f.name}: ${invalid}`, f.id); continue; }
    if (f.directionApproval && !directionApproved(f)) error('FACE_REVIEW_CHANGED', `${f.name}: its shape or water arrow changed. Confirm this face again.`, f.id);
    if (!f.confirmed) error('FACE_UNCONFIRMED', `${f.name}: review and confirm this face.`, f.id);
    if (f.pitchDeg === null || !Number.isFinite(f.pitchDeg) || f.pitchDeg < 0 || f.pitchDeg >= 80) error('PITCH', `${f.name}: enter a confirmed pitch from 0° to less than 80°. A 45° plan hip does not remove pitch from surface geometry.`, f.id);
    if (!f.flow || !Number.isFinite(f.flow.x) || !Number.isFinite(f.flow.y) || Math.hypot(f.flow.x, f.flow.y) < EPS) { error('FLOW', `${f.name}: water direction is missing.`, f.id); continue; }
    if (f.lap !== 1 && f.lap !== -1) error('LAP', `${f.name}: invalid lap direction.`, f.id);
    if (!Number.isFinite(f.laneOffsetMm) || f.laneOffsetMm < 0 || f.laneOffsetMm >= p.coverMm) error('LANE_PHASE', `${f.name}: lane offset must be at least zero and less than one effective cover.`, f.id);
    issues.push(...validateFaceDirections(f, roof));
  }
  return issues;
}
/** Effective-cover cells are always rounded UP. The tiny tolerance only removes
 * IEEE floating-point noise at an exact whole-sheet boundary, never real gaps. */
export function sheetCount(spanMm: number, coverMm: number, offsetMm = 0): number {
  if (![spanMm, coverMm, offsetMm].every(Number.isFinite) || spanMm <= 0 || coverMm <= 0 || offsetMm < 0 || offsetMm >= coverMm) throw new Error('Invalid sheet span, cover or registration.');
  return Math.ceil((spanMm + offsetMm) / coverMm - 1e-10);
}
/** Geometric rectangle predicate, NOT the definition of a planning filler.
 * Kept for the safe short-stock check and legacy callers. A ridge filler may
 * have valley/hip cuts; its role is recorded independently on the demand. */
export function isStraightFiller(required: Demand['required']): boolean {
  return required.length > 0 && isMonotone(required) && required.every(b =>
    Math.abs(b.top1 - b.top0) < EPS && Math.abs(b.bottom1 - b.bottom0) < EPS) &&
    required.every(b => Math.abs(b.top0 - required[0].top0) < EPS && Math.abs(b.bottom0 - required[0].bottom0) < EPS);
}
export function validateBankLayout(faces: RoofFace[], profile: Profile, settings: SolveSettings, layout: BankLayout): void {
  if (settings.stockMode !== 'bank-first') throw new Error('A bank layout requires bank-first mode.');
  if(layout.stockEndRefinement){
    const q=layout.stockEndRefinement;
    if(q.model!==STOCK_END_MODEL||!Array.isArray(q.demandIds)||!q.demandIds.length||q.demandIds.length>settings.maxSheets||
      q.demandIds.some(id=>typeof id!=='string')||new Set(q.demandIds).size!==q.demandIds.length)throw new Error('Invalid stock-end refinement model.');
  }
  const ids = new Set(faces.map(f => f.id));
  if (new Set(layout.primaryFaceIds).size !== layout.primaryFaceIds.length || layout.primaryFaceIds.some(id => !ids.has(id))) throw new Error('Invalid primary face selection.');
  if (Object.keys(layout.laneOffsetByFace).length !== faces.length || Object.keys(layout.extraLengthByFace).length !== faces.length ||
      [...Object.keys(layout.laneOffsetByFace), ...Object.keys(layout.extraLengthByFace)].some(id => !ids.has(id))) throw new Error('Bank layout does not match the reviewed faces.');
  if(layout.selfFillFaceIds && (new Set(layout.selfFillFaceIds).size!==layout.selfFillFaceIds.length || layout.selfFillFaceIds.some(id=>!ids.has(id)||!layout.primaryFaceIds.includes(id)))) throw new Error('Invalid self-fill face selection.');
  if (layout.materialBanks) {
    const members = layout.materialBanks.flatMap(b => b.faceIds);
    if (members.length !== faces.length || new Set(members).size !== faces.length || members.some(id => !ids.has(id))) throw new Error('Material-bank membership does not match the approved faces.');
    if (new Set(layout.materialBanks.map(b=>b.id)).size !== layout.materialBanks.length || layout.materialBanks.some(b=>!Number.isFinite(b.cutLengthMm) || b.cutLengthMm<=0)) throw new Error('Invalid material-bank identity or stock length.');
    for(const bank of layout.materialBanks){
      const members=faces.filter(f=>bank.faceIds.includes(f.id));
      if(!bank.flow || !Number.isFinite(bank.flow.x) || !Number.isFinite(bank.flow.y) || Math.hypot(bank.flow.x,bank.flow.y)<EPS ||
        members.some(a=>!a.flow || a.pitchDeg===null || Math.abs(a.pitchDeg-bank.pitchDeg)>1e-6 || dot(unit(a.flow),unit(bank.flow))<Math.cos(2*Math.PI/180)) ||
        members.some(a=>members.some(b=>a.flow && b.flow && dot(unit(a.flow),unit(b.flow))<Math.cos(2*Math.PI/180))))
        throw new Error('Material banks must preserve compatible approved run directions and pitches.');
    }
  }
  const operationMembers=new Set<string>(),operationIds=new Set<string>();
  for(const op of layout.primaryOperations??[]){
    const bank=layout.materialBanks?.find(b=>b.id===op.bankId);
    if(!op.id||operationIds.has(op.id)||!bank||!op.faceIds?.length||!Number.isFinite(op.phaseMm)||op.phaseMm<0||op.phaseMm>=profile.coverMm||
      !Number.isFinite(op.stockLengthMm)||op.stockLengthMm<=0||op.stockLengthMm>profile.maxLengthMm)
      throw new Error('Invalid common-stock operation metadata.');
    operationIds.add(op.id);
    for(const id of op.faceIds){
      if(operationMembers.has(id)||!bank.faceIds.includes(id)||!layout.primaryFaceIds.includes(id)||
        Math.abs((layout.cutLengthByFace?.[id]??0)-op.stockLengthMm)>.01)
        throw new Error('Common-stock operations cannot join unrelated or differently supplied faces.');
      operationMembers.add(id);
    }
  }
  for(const [id,length] of Object.entries(layout.receiverStockLengthByFace??{})){
    if(!ids.has(id)||!Number.isFinite(length)||length<=0||length>profile.maxLengthMm)throw new Error('Invalid local receiver stock length.');
  }
  for (const f of faces) {
    const common = layout.cutLengthByFace?.[f.id], tail = layout.tailExtensionByFace?.[f.id] ?? 0;
    if (common !== undefined && (!Number.isFinite(common) || common <= 0 || common > profile.maxLengthMm)) throw new Error(`${f.name}: invalid common stock length.`);
    if (!Number.isFinite(tail) || tail < 0 || tail + layout.extraLengthByFace[f.id] > (settings.maxBankExtensionMm ?? 100) + EPS) throw new Error(`${f.name}: invalid total cutting extension.`);
    const offset = layout.laneOffsetByFace[f.id], extra = layout.extraLengthByFace[f.id];
    if (!Number.isFinite(offset) || offset < 0 || offset >= profile.coverMm ||
        f.laneOffsetLocked && Math.abs(offset - f.laneOffsetMm) > EPS) throw new Error(`${f.name}: invalid or locked sheet registration.`);
    if (!Number.isFinite(extra) || extra < 0 || extra > (settings.maxBankExtensionMm ?? 100) + EPS ||
        !layout.primaryFaceIds.includes(f.id) && extra > EPS) throw new Error(`${f.name}: invalid primary stock extension.`);
  }
}
/** Validated once by the caller; used repeatedly by the bounded bank search. */
export function generateFaceDemands(roof: RoofInput, face: RoofFace, profile: Profile, settings: SolveSettings,
  primary = true, extraLengthMm = 0, cutLengthMm?: number, tailExtensionMm = 0, materialBankId?: string, receiverStockLengthMm?: number): Demand[] {
  const result: Demand[] = [], w = profile.coverMm, physicalWidth = w + profile.leftLapMm + profile.rightLapMm;
  const boundary = planningBoundary(face);
  const frame = frameFor(face, roof), local = fromRing(face.polygon.map(p => sceneToSurface(p, frame))), box = bounds(local);
  // V2.2 approval boundary: once the roofer confirms a face, its polygon and
  // run direction are authoritative cut-planning input. A concave/notched face
  // can produce more than one vertical interval in the exact polygon sweep.
  // That must not reopen architectural interpretation or block Find Offcuts.
  // Each physical sheet lane therefore uses one continuous planning envelope
  // from the first to last approved-face intersection. `cover` below remains
  // the exact approved polygon, so net roof quantities are not enlarged.
  const continuousRunEnvelope = (region: typeof local): typeof local => {
    if (isMonotone(region)) return region;
    const xs = [...new Set(region.flatMap(b => [b.x0, b.x1]).map(x => +x.toFixed(9)))].sort((a, b) => a - b);
    const out: typeof local = [];
    const value = (b: (typeof region)[number], x: number, top: boolean): number => {
      const t = (x - b.x0) / (b.x1 - b.x0);
      const a = top ? b.top0 : b.bottom0, z = top ? b.top1 : b.bottom1;
      return a + (z - a) * t;
    };
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], mid = (x0 + x1) / 2;
      const active = region.filter(b => b.x0 < mid && b.x1 > mid);
      if (!active.length) continue;
      const topBand = active.reduce((best, b) => value(b, mid, true) < value(best, mid, true) ? b : best);
      const bottomBand = active.reduce((best, b) => value(b, mid, false) > value(best, mid, false) ? b : best);
      out.push({ x0, x1, top0: value(topBand, x0, true), top1: value(topBand, x1, true),
        bottom0: value(bottomBand, x0, false), bottom1: value(bottomBand, x1, false) });
    }
    return out;
  };
  const planningLocal = continuousRunEnvelope(local);
  const spans = (kind: 'ridge' | 'spouting', left: number, right: number): number => {
    // Classified roof boundaries, not objects in the plan image. A ridge role
    // survives a cut at the OTHER end of that same sheet (for example C's V).
    const intervals=boundary.filter(e=>e.kind===kind).map(e=>{
      const a=sceneToSurface(e.a,frame),b=sceneToSurface(e.b,frame);
      return [Math.max(left,Math.min(a.x,b.x)),Math.min(right,Math.max(a.x,b.x))];
    }).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
    let length=0,end=-Infinity;
    for(const [a,b] of intervals){length+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
    return length;
  };
  const start = box.minX - face.laneOffsetMm, count = sheetCount(box.maxX - box.minX, w, face.laneOffsetMm);
  if (count > settings.maxSheets) throw new Error(`Sheet limit exceeded (${settings.maxSheets}). Check the calibration/cover or reduce the selected roof scope.`);
  for (let i = 0; i < count; i++) {
    const x = start + i * w;
    const cover = intersect(local, rectangle(x, box.minY - 1, x + w, box.maxY + 1));
    if (area(cover) < EPS) continue;
    const laneX = x - profile.leftLapMm;
    const physical = intersect(planningLocal, rectangle(laneX, box.minY - 1, laneX + physicalWidth, box.maxY + 1));
    const expanded = extendY(physical, profile.endAllowanceMm), physicalBox = bounds(expanded);
    const y = physicalBox.minY, required = translate(expanded, -laneX, -y);
    const bank = settings.stockMode === 'bank-first';
    const receiverStock=bank&&receiverStockLengthMm!==undefined;
    const envelope = settings.stockMode === 'face-envelope' || bank && (primary||receiverStock);
    const extra = bank && primary ? extraLengthMm : 0;
    const cutEdges: RoofEdge[] = boundary.filter(e => ['hip', 'valley', 'broken_hip'].includes(e.kind))
      .map(e => ({ ...e, a: sub(sceneToSurface(e.a, frame), {x: laneX, y}), b: sub(sceneToSurface(e.b, frame), {x: laneX, y}) }))
      .filter(e => Math.min(e.a.x, e.b.x) < physicalWidth - EPS && Math.max(e.a.x, e.b.x) > EPS);
    // Elevation banks share a STOCK length, never merged roof footprints.
    // Every separate face/run still has its own real required and cover regions.
    const baseLength = Math.max(box.maxY - box.minY, receiverStockLengthMm ?? cutLengthMm ?? 0);
    // A LOWER ridge plateau uses shorter stock only when no reusable angled cut
    // crosses that physical lane. A valley at the other end keeps long stock. The boundary-crossing lane retains full bank stock;
    // we never shorten the one long sheet needed to cut through a broken hip.
    const coverWidth=Math.min(x+w,box.maxX)-Math.max(x,box.minX);
    const lowerRidgeShelf=bank && primary && cutEdges.length===0 && spans('ridge',x,x+w)>=coverWidth-EPS &&
      required.every(b=>Math.abs(b.top0)<EPS&&Math.abs(b.top1)<EPS) &&
      y>box.minY+profile.endAllowanceMm+EPS;
    const blankY0 = envelope && !lowerRidgeShelf ? box.maxY - baseLength - profile.endAllowanceMm - y - extra : 0;
    const tail = envelope && !lowerRidgeShelf ? tailExtensionMm : 0;
    const rawY1 = envelope ? box.maxY + profile.endAllowanceMm - y + tail : physicalBox.maxY - y;
    const len = Math.ceil((rawY1 - blankY0 - EPS) / profile.lengthIncrementMm) * profile.lengthIncrementMm;
    if (len > profile.maxLengthMm + EPS) throw new Error(`${face.name}, lane ${i + 1}: ${(len / 1000).toFixed(3)} m exceeds the profile maximum. The planner never inserts end laps to make it fit.`);
    const reusableCut = boundary.some(edge => {
      if (!['hip', 'valley', 'broken_hip'].includes(edge.kind)) return false;
      const a = sceneToSurface(edge.a, frame), b = sceneToSurface(edge.b, frame);
      return Math.max(a.x, b.x) >= laneX - EPS && Math.min(a.x, b.x) <= laneX + physicalWidth + EPS;
    });
    result.push({ id: `${face.id}:sheet:${i + 1}`, faceId: face.id, laneIndex: i, lap: face.lap,
      widthMm: physicalWidth, origin: { x: laneX, y }, frame, required, reusableCut, cutEdges,
      zoneRole: spans('ridge',x,x+w)>EPS ? 'ridge-fill' : 'cut-zone',
      ridgeOverlapMm: spans('ridge',x,x+w), eaveOverlapMm: spans('spouting',x,x+w), ...(materialBankId ? {materialBankId} : {}),
      cover: translate(cover, -laneX, -y), blank: rectangle(0, blankY0, physicalWidth, blankY0 + len),
      ...(bank ? { stockRole: primary ? lowerRidgeShelf || !boundary.some(e=>['hip','valley','broken_hip'].includes(e.kind)) ? 'filler' as const : 'primary-cut' as const : 'supplement' as const } : {}) });
  }
  return result;
}
export function generateDemands(roof: RoofInput, faces: RoofFace[], profile: Profile, settings: SolveSettings, layout?: BankLayout): Demand[] {
  const errors = validateInputs(roof, faces, profile, settings).filter(i => i.severity === 'error');
  if (errors.length) throw new Error(errors.map(i => i.message).join('\n'));
  if (layout) validateBankLayout(faces, profile, settings, layout);
  const result = faces.flatMap(face => generateFaceDemands(roof,
    layout ? { ...face, laneOffsetMm: layout.laneOffsetByFace[face.id] } : face,
    profile, settings, layout ? layout.primaryFaceIds.includes(face.id) : true, layout?.extraLengthByFace[face.id] ?? 0,
    layout?.cutLengthByFace?.[face.id], layout?.tailExtensionByFace?.[face.id] ?? 0,
    layout?.materialBanks?.find(b => b.faceIds.includes(face.id))?.id, layout?.receiverStockLengthByFace?.[face.id]));
  if (result.length > settings.maxSheets) throw new Error(`Sheet limit exceeded (${settings.maxSheets}). Check the calibration/cover or reduce the selected roof scope.`);
  if(layout?.stockEndRefinement){
    const ids=new Set(layout.stockEndRefinement.demandIds);
    if([...ids].some(id=>!result.some(d=>d.id===id)))throw new Error('Stock-end refinement references a missing lane.');
    return result.map(d=>{
      if(!ids.has(d.id))return d;
      if(!layout.primaryFaceIds.includes(d.faceId)||layout.selfFillFaceIds?.includes(d.faceId)||layout.receiverStockLengthByFace?.[d.faceId]!==undefined)
        throw new Error('Only unprotected primary purchasing stock may use the stock-end refinement.');
      const refined=proposeStockEnds(d,profile,layout.extraLengthByFace[d.faceId]??0,layout.tailExtensionByFace?.[d.faceId]??0,offcutsFrom);
      if(!refined)throw new Error('This lane cannot be shortened without changing its physical cut envelope.');
      return refined;
    });
  }
  return result;
}
/** Solution-only validation replays the deterministic proof. validateDraft ALSO
 * regenerates original blanks from the reviewed roof, so an imported proof
 * cannot define a different original roof/bank geometry. */
export function validStockEndProof(d:Demand,profile:Profile,layout?:BankLayout):boolean {
  try{
    const proof=d.stockEndProof,q=layout?.stockEndRefinement;
    if(!proof||proof.model!==STOCK_END_MODEL||q?.model!==STOCK_END_MODEL||!q.demandIds.includes(d.id)||
      !layout!.primaryFaceIds.includes(d.faceId)||layout!.selfFillFaceIds?.includes(d.faceId)||layout!.receiverStockLengthByFace?.[d.faceId]!==undefined)return false;
    const original=originalStockDemand(d);
    const expected=proposeStockEnds(original,profile,layout!.extraLengthByFace[d.faceId]??0,layout!.tailExtensionByFace?.[d.faceId]??0,offcutsFrom);
    return !!expected&&sameStockData(expected,d);
  }catch{return false;}
}
/** Produce inventory only at an approved hip/valley cut, from ACTUAL available
 * metal. The same operation is used when a reused sheet is trimmed again.
 * Parent identity is retained, and the validator rebuilds the entire cut tree. */
export function offcutsFromMaterial(d: Demand, profile: Profile, available: Region, parent?: Offcut): Offcut[] {
  if (d.reusableCut === false) return [];
  const left = subtract(available, extendY(d.required, profile.cutGapMm));
  const pieces = components(left).filter(r => area(r) > 1);
  const result: Offcut[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const region = pieces[i];
    const classification = classifyCut(d, profile, region);
    // Old externally constructed demands without boundary metadata retain the
    // legacy path; all demands generated by V2.4 carry cutEdges, even if empty.
    if (d.cutEdges && !classification) continue;
    result.push({
      id: `${d.id}:${parent ? 'recut' : 'offcut'}:${i+1}`,
      sourceDemandId: d.id, sourceFaceId: d.faceId, region,
      widthMm: d.widthMm, lap: d.lap,
      rootDemandId: parent?.rootDemandId ?? parent?.sourceDemandId ?? d.id,
      rootBankId: parent?.rootBankId ?? d.materialBankId ?? d.faceId,
      ...(parent ? {parentOffcutId: parent.id} : {}),
      generation: (parent?.generation ?? -1) + 1,
      sourceLaneIndex: d.laneIndex,
      sourceCrossMm: dot(d.frame.origin, d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x,
      ...(classification ?? {}),
    });
  }
  return result;
}
export function offcutsFrom(d: Demand, profile: Profile): Offcut[] {
  return offcutsFromMaterial(d, profile, d.blank);
}
function classifyCut(d: Demand, profile: Profile, region: Region): Pick<Offcut,'cutSetId'|'cutKind'|'cutArm'> | undefined {
  let best: {edge: RoofEdge; length: number; side: string; slope: number} | undefined;
  const touchedSlopes:number[]=[];
  const border = boundarySegments(region), margin = profile.cutGapMm + profile.endAllowanceMm;
  for (const edge of d.cutEdges ?? []) {
    const dx = edge.b.x - edge.a.x;
    if (Math.abs(dx) < EPS) continue; // longitudinal barge-like trim is not a set
    const slope = (edge.b.y-edge.a.y)/dx;
    let length = 0, side = '';
    for (const seg of border) {
      const x0 = Math.max(Math.min(seg.a.x,seg.b.x),Math.min(edge.a.x,edge.b.x));
      const x1 = Math.min(Math.max(seg.a.x,seg.b.x),Math.max(edge.a.x,edge.b.x));
      if (x1-x0 < EPS || Math.abs(seg.b.x-seg.a.x)<EPS) continue;
      const m = (seg.b.y-seg.a.y)/(seg.b.x-seg.a.x);
      if (Math.abs(m-slope)>1e-5) continue;
      const x=(x0+x1)/2, y=seg.a.y+m*(x-seg.a.x), ey=edge.a.y+slope*(x-edge.a.x);
      if (Math.abs(Math.abs(y-ey)-margin) < 1e-3) { length += x1-x0; side = y<ey ? 'upper' : 'lower'; }
    }
    if(length>EPS)touchedSlopes.push(slope);
    if (length > (best?.length ?? 0)) best={edge,length,side,slope};
  }
  if (!best) return undefined;
  const cutKind = best.edge.kind as 'hip'|'valley'|'broken_hip';
  // Both arms of an up-and-over valley are one ordered set. Hip halves retain
  // their handedness; separate steps/fillers are split into contiguous runs by
  // the coherent matcher instead of inventing missing sheets between them.
  const shape = cutKind === 'valley' ? 'V' : best.slope < 0 ? 'left' : 'right';
  return {cutKind, cutSetId:`${d.faceId}:${cutKind}:${best.side}:${shape}`,
    cutArm:touchedSlopes.some(m=>m<0)&&touchedSlopes.some(m=>m>0)?'apex':best.slope<0?'negative':'positive'};
}
