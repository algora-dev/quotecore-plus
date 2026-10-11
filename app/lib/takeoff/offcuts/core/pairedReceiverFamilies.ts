/** V2.26: physical family identity and a replayable paired-receiver certificate.
 * This module never changes a plan. Historical (uncertified) V2.25 plans retain
 * their original meaning. In the inventory, generation 0 is the first offcut;
 * generation 1 is an offcut cut again in a receiving face. */
import type { Demand, Issue, Offcut, Placement, Point, Solution, SolveRequest } from './types';
import { installationAnchors, coverPhase, type InstallationAnchor } from './installationAnchors';
import { planningBoundary } from './directions';
import { frameFor, sceneToSurface } from './material';
import { area, bounds, rotate180, subtract } from './regions';
import { materialAtDestination, rebuildInventory } from './inventory';
import { fingerprint, dot } from './math';
import { rootSheetLedger } from './purchaseLedger';
import { findFit } from './fit';

export const PAIRED_RECEIVER_MODEL = 'paired-receiver-families-v1' as const;
export const PAIRED_RECEIVER_POLICY = Object.freeze({
  minimumFamilyPieces: 2, phaseDivisions: 8, maximumTransactions: 12,
  maximumProposals: 96, maximumReturned: 2,
});
export interface PhysicalCutFamily {
  id: string; donorFaceId: string; cutSetId: string; pieces: Offcut[];
  /** Complete maximal consecutive run, not a favourable three-piece subset. */
  sourceLanes: number[]; heightDirection: -1 | 0 | 1;
}
export interface ReceiverEnd {
  id: string; side: 'negative-u' | 'positive-u'; hipEdgeId: string;
  anchor: InstallationAnchor; crossMm: number; downstreamFaceIds: string[];
}
export interface PairedReceiverOpportunity { faceId: string; ends: [ReceiverEnd, ReceiverEnd] }
export interface PairedReceiverProposal {
  receiverFaceId: string; phaseMm: number; registrationAnchorId: string;
  phaseOffsetMm: number; fittingClearanceMm: number;
  families: Array<{ familyId: string; endId: string }>;
}
export interface PairedReceiverCertificate {
  model: typeof PAIRED_RECEIVER_MODEL; inputFingerprint: string;
  referenceLayoutId: string; donorLayoutId: string; proposal: PairedReceiverProposal;
  families: Array<{
    familyId: string; donorFaceId: string; donorBankIds: string[]; cutSetId: string;
    endId: string; side: ReceiverEnd['side']; anchor: InstallationAnchor;
    anchorGridOffsetMm: number; offcutIds: string[]; rootDemandIds: string[];
    sourceLanes: number[]; receiverDemandIds: string[]; receiverLanes: number[];
    rotation: 0 | 180; heightDirection: -1 | 0 | 1; cutArms: string[];
    downstreamFaceIds: string[];
    secondary: Array<{ offcutId: string; parentOffcutId: string; rootDemandId: string;
      destinationDemandId: string | null; destinationFaceId: string | null;
      reason: 'installed' | 'no-compatible-fresh-position' | 'compatible-but-not-selected' }>;
  }>;
  freshPurchases: Array<{ demandId: string; lengthMm: number; role: 'straight-filler' | 'transition-starter' }>;
  coveredDemandIds: string[]; dependencyOrder: string[];
  physicalFingerprint: string; purchasedSheets: number; purchasedLinealM: number;
  /** Setout and profile must still be confirmed by the roofer. No order approval. */
  siteSetoutConfirmed: false;
}
export class PairedReceiverRejection extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'PairedReceiverRejection'; }
}
const reject = (code: string): never => { throw new PairedReceiverRejection(code); };
const near = (a: Point, b: Point): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 1e-5;
const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-5;

/** Family membership is rebuilt from purchased roots. The same cutSetId can
 * occur on two separated hips: a missing lane separates two real cutting runs.
 * Apex pieces are never divided, mirrored or assigned a second identity. */
export function physicalCutFamilies(s: Solution, donorFaceIds: string[]): PhysicalCutFamily[] {
  const dm = new Map(s.demands.map(d => [d.id, d]));
  const fresh = new Set(s.placements.filter(p => p.kind === 'new').map(p => p.demandId));
  const buckets = new Map<string, Offcut[]>();
  for (const o of s.offcuts) {
    const d = dm.get(o.sourceDemandId);
    if (!d || !fresh.has(d.id) || !donorFaceIds.includes(d.faceId) || o.parentOffcutId ||
      (o.generation ?? 0) !== 0 || (o.rootDemandId ?? o.sourceDemandId) !== d.id ||
      !o.cutSetId || !['hip', 'broken_hip'].includes(o.cutKind ?? '') ||
      o.sourceLaneIndex !== d.laneIndex) continue;
    const key = d.faceId + '|' + o.cutSetId, bucket = buckets.get(key) ?? [];
    bucket.push(o); buckets.set(key, bucket);
  }
  const result: PhysicalCutFamily[] = [];
  function add(pieces: Offcut[]) {
    if (pieces.length < PAIRED_RECEIVER_POLICY.minimumFamilyPieces) return;
    const heights = pieces.map(o => area(o.region) / o.widthMm);
    const deltas = heights.slice(1).map((h, i) => h - heights[i]);
    // Reject stepped/zig-zag families rather than shortening or hiding a lane.
    if (deltas.some(d => d > .001) && deltas.some(d => d < -.001)) return;
    const direction: -1 | 0 | 1 = deltas.some(d => d > .001) ? 1 : deltas.some(d => d < -.001) ? -1 : 0;
    if (!direction) return;
    result.push({ id: 'family:' + fingerprint(pieces.map(o => [o.id, o.rootDemandId, o.cutSetId])),
      donorFaceId: pieces[0].sourceFaceId, cutSetId: pieces[0].cutSetId!, pieces,
      sourceLanes: pieces.map(o => o.sourceLaneIndex!), heightDirection: direction });
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.sourceLaneIndex! - b.sourceLaneIndex! || a.id.localeCompare(b.id));
    let run: Offcut[] = [];
    for (const o of bucket) {
      if (run.length && o.sourceLaneIndex !== run.at(-1)!.sourceLaneIndex! + 1) { add(run); run = []; }
      run.push(o);
    }
    add(run);
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

/** Topology, not face names or screen left/right, identifies opposite ends.
 * A downstream face can be separated by one reviewed shoulder face. */
export function pairedReceiverOpportunities(r: SolveRequest, donorFaceIds: string[], receiverFaceIds: string[]): PairedReceiverOpportunity[] {
  const neighbours = new Map(r.faces.map(f => [f.id, new Set<string>()]));
  for (let i = 0; i < r.faces.length; i++) for (let j = i + 1; j < r.faces.length; j++) {
    const a = r.faces[i], b = r.faces[j];
    if (a.polygon.some((p, k) => b.polygon.some((q, l) =>
      near(p, q) && near(a.polygon[(k + 1) % a.polygon.length], b.polygon[(l + b.polygon.length - 1) % b.polygon.length]) ||
      near(p, b.polygon[(l + 1) % b.polygon.length]) && near(a.polygon[(k + 1) % a.polygon.length], q)))) {
      neighbours.get(a.id)!.add(b.id); neighbours.get(b.id)!.add(a.id);
    }
  }
  const result: PairedReceiverOpportunity[] = [];
  for (const face of r.faces.filter(f => receiverFaceIds.includes(f.id) && !donorFaceIds.includes(f.id))) {
    const frame = frameFor(face, r.roof);
    const anchors = installationAnchors(face, r.roof, r.profile).filter(a => a.kind === 'hip-ridge-junction')
      .sort((a, b) => sceneToSurface(a.point, frame).x - sceneToSurface(b.point, frame).x);
    if (anchors.length < 2) continue;
    const selected = [anchors[0], anchors.at(-1)!];
    if (sceneToSurface(selected[1].point, frame).x - sceneToSurface(selected[0].point, frame).x < r.profile.coverMm) continue;
    const reachable = new Set(neighbours.get(face.id));
    for (const id of [...reachable]) for (const other of neighbours.get(id) ?? []) reachable.add(other);
    const ends = selected.map((anchor, i): ReceiverEnd | null => {
      const hip = planningBoundary(face).find(e => anchor.edgeIds.includes(e.id) && ['hip', 'broken_hip'].includes(e.kind));
      if (!hip) return null;
      const crossMm = sceneToSurface(anchor.point, frame).x, side = i === 0 ? 'negative-u' : 'positive-u';
      const far = sceneToSurface(near(hip.a, anchor.point) ? hip.b : hip.a, frame).x;
      if (i === 0 ? far >= crossMm : far <= crossMm) return null;
      const downstreamFaceIds = r.faces.filter(f => f.id !== face.id && receiverFaceIds.includes(f.id) &&
        !donorFaceIds.includes(f.id) && reachable.has(f.id) && !!f.flow && !!face.flow && dot(f.flow!, face.flow!) > .95 &&
        (i === 0 ? f.polygon.reduce((n, p) => n + sceneToSurface(p, frame).x, 0) / f.polygon.length < crossMm :
          f.polygon.reduce((n, p) => n + sceneToSurface(p, frame).x, 0) / f.polygon.length > crossMm)).map(f => f.id).sort();
      return { id: 'receiver-end:' + fingerprint([face.id, hip.id, side]), side, hipEdgeId: hip.id, anchor, crossMm, downstreamFaceIds };
    });
    if (ends[0] && ends[1]) result.push({ faceId: face.id, ends: [ends[0], ends[1]] });
  }
  return result;
}

/** Preserve the HIP-facing orientation. A bottom-sloping piece that happens to
 * contain a valley demand is not the intended upper hip triangle. Containment
 * remains an independent hard check; this test cannot enlarge the metal. */
export function facesReceiverHip(o: Offcut, rotation: 0 | 180, end: ReceiverEnd): boolean {
  const region = rotation === 180 ? rotate180(o.region, o.widthMm) : o.region;
  const expected = end.side === 'negative-u' ? -1 : 1;
  let useful = 0, contrary = 0;
  for (const b of region) {
    const change = b.top1 - b.top0;
    if (change * expected > .001) useful += Math.abs(change);
    if (change * expected < -.001) contrary += Math.abs(change);
  }
  return useful > .001 && contrary < .001;
}

export function pairedPhysicalFingerprint(s: Solution): string {
  return fingerprint([s.demands, s.placements, s.offcuts, s.lapByFace, s.bankLayout, s.profile, s.settings, s.receiverSafety]);
}

/** Reconstruct evidence, including the entire source run and every child, from
 * the final transaction. A stored certificate is never accepted on trust. */
export function derivePairedReceiverCertificate(r: SolveRequest, s: Solution, proposal: PairedReceiverProposal,
  referenceLayoutId: string, donorLayoutId: string): PairedReceiverCertificate {
  const plan = s.installationPlan;
  if (!plan || plan.kind !== 'reversed-donors' || plan.referenceLayoutId !== referenceLayoutId) reject('wrong-reference-plan');
  if (!proposal || !Number.isFinite(proposal.phaseMm) || proposal.phaseMm < 0 || proposal.phaseMm >= r.profile.coverMm ||
    !Number.isFinite(proposal.phaseOffsetMm) || proposal.phaseOffsetMm < 0 || proposal.phaseOffsetMm >= r.profile.coverMm ||
    !Number.isFinite(proposal.fittingClearanceMm) || proposal.fittingClearanceMm < Math.min(100, Math.max(20, r.profile.cutGapMm * 2)) || proposal.fittingClearanceMm > 100 ||
    !Array.isArray(proposal.families) || proposal.families.length !== 2) reject('invalid-paired-proposal');
  const opportunity = pairedReceiverOpportunities(r, plan!.donorFaceIds, plan!.receiverFaceIds).find(o => o.faceId === proposal.receiverFaceId);
  if (!opportunity) reject('unavailable-receiver-ends');
  const datum = opportunity!.ends.find(e => e.anchor.id === proposal.registrationAnchorId)?.anchor;
  const face = r.faces.find(f => f.id === proposal.receiverFaceId)!;
  if (!datum || !close(coverPhase(datum.phaseMm + proposal.phaseOffsetMm, r.profile.coverMm), proposal.phaseMm) ||
    !close(s.bankLayout?.laneOffsetByFace[face.id] ?? -1, proposal.phaseMm) ||
    face.laneOffsetLocked && !close(face.laneOffsetMm, proposal.phaseMm)) reject('invalid-receiver-registration');
  const rebuilt = rebuildInventory(s.demands, s.placements, s.profile);
  if (rebuilt.unresolved.length || fingerprint([...rebuilt.offcuts].sort((a, b) => a.id.localeCompare(b.id))) !==
    fingerprint([...s.offcuts].sort((a, b) => a.id.localeCompare(b.id)))) reject('unresolved-or-stale-inventory');
  const ledger = rootSheetLedger(s);
  if (!ledger.valid) reject(ledger.issues.some(i => /DOUBLE|DUPLICATE/.test(i.code)) ? 'double-spend' : 'stock-not-conserved');
  const dm = new Map(s.demands.map(d => [d.id, d])), pm = new Map(s.placements.map(p => [p.demandId, p]));
  const inventory = new Map(s.offcuts.map(o => [o.id, o]));
  const families = physicalCutFamilies(s, plan!.donorFaceIds);
  const ds = s.demands.filter(d => d.faceId === face.id).sort((a, b) => a.laneIndex - b.laneIndex);
  const assigned = new Set<string>(), endsUsed = new Set<string>(), donorsUsed = new Set<string>();
  const rows: PairedReceiverCertificate['families'] = [];
  for (const pair of proposal.families) {
    const family = families.find(f => f.id === pair.familyId), end = opportunity!.ends.find(e => e.id === pair.endId);
    if (!family || !end || endsUsed.has(pair.endId) || donorsUsed.has(family.donorFaceId)) reject('unavailable-triangle-family');
    endsUsed.add(pair.endId); donorsUsed.add(family!.donorFaceId);
    const placements = family!.pieces.map(o => s.placements.filter(p => p.kind === 'reuse' && p.offcutId === o.id));
    if (placements.some(ps => ps.length !== 1 || dm.get(ps[0].demandId)?.faceId !== face.id)) reject('incomplete-whole-family');
    const ps = placements.map(p => p[0]), rotation = ps[0].rotation, sign = rotation === 180 ? -1 : 1;
    const laneIds = ps.map(p => dm.get(p.demandId)!.laneIndex);
    const expected = (end!.side === 'negative-u' ? ds.slice(0, ps.length) : ds.slice(-ps.length)).map(d => d.laneIndex).sort((a, b) => a - b);
    if (fingerprint([...laneIds].sort((a, b) => a - b)) !== fingerprint(expected) ||
      laneIds.some((n, i) => i > 0 && n !== laneIds[i - 1] + sign) || ps.some(p => p.rotation !== rotation)) reject('wrong-receiver-end');
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], o = family!.pieces[i], d = dm.get(p.demandId)!;
      if (assigned.has(d.id)) reject('double-spend'); assigned.add(d.id);
      if ((d.eaveOverlapMm ?? 0) > 1e-7 || !d.cutEdges?.some(e => e.id === end!.hipEdgeId)) reject('starter-insufficient');
      if (!facesReceiverHip(o, rotation, end!) || (rotation === 180 && !r.profile.allowEndForEnd) ||
        (rotation === 180 ? -o.lap : o.lap) !== d.lap || !close(o.widthMm, d.widthMm)) reject('lap-or-hip-orientation-incompatible');
      const margin = proposal.fittingClearanceMm;
      const need = d.required.map(b => ({ ...b, top0: b.top0 - margin, top1: b.top1 - margin, bottom0: b.bottom0 + margin, bottom1: b.bottom1 + margin }));
      if (area(subtract(need, materialAtDestination(o, p))) > Math.max(.001, area(need) * 1e-9)) reject('insufficient-fitting-clearance');
    }
    const children = s.offcuts.filter(o => o.sourceFaceId === face.id && !!o.parentOffcutId && family!.pieces.some(p => p.id === o.parentOffcutId));
    const secondary: PairedReceiverCertificate['families'][number]['secondary'] = [];
    for (const child of children) {
      const installed = s.placements.find(p => p.kind === 'reuse' && p.offcutId === child.id);
      const target = installed ? dm.get(installed.demandId) : undefined;
      if (target && !end!.downstreamFaceIds.includes(target.faceId)) reject('secondary-wrong-receiver-end');
      const compatible = !target && s.demands.some(d => end!.downstreamFaceIds.includes(d.faceId) && pm.get(d.id)?.kind === 'new' && findFit(child, d, s.profile));
      secondary.push({ offcutId: child.id, parentOffcutId: child.parentOffcutId!, rootDemandId: child.rootDemandId!,
        destinationDemandId: target?.id ?? null, destinationFaceId: target?.faceId ?? null,
        reason: target ? 'installed' : compatible ? 'compatible-but-not-selected' : 'no-compatible-fresh-position' });
    }
    rows.push({ familyId: family!.id, donorFaceId: family!.donorFaceId,
      donorBankIds: [...new Set(family!.pieces.map(o => o.rootBankId ?? o.sourceFaceId))].sort(), cutSetId: family!.cutSetId,
      endId: end!.id, side: end!.side, anchor: end!.anchor,
      anchorGridOffsetMm: coverPhase(proposal.phaseMm - end!.anchor.phaseMm, r.profile.coverMm),
      offcutIds: family!.pieces.map(o => o.id), rootDemandIds: family!.pieces.map(o => o.rootDemandId ?? o.sourceDemandId),
      sourceLanes: family!.sourceLanes, receiverDemandIds: ps.map(p => p.demandId), receiverLanes: laneIds,
      rotation, heightDirection: family!.heightDirection, cutArms: family!.pieces.map(o => o.cutArm ?? 'unspecified'),
      downstreamFaceIds: end!.downstreamFaceIds, secondary });
  }
  if (donorsUsed.size !== plan!.donorFaceIds.length || plan!.donorFaceIds.some(id => !donorsUsed.has(id))) reject('incomplete-paired-donors');
  if (ds.some(d => !assigned.has(d.id) && pm.get(d.id)?.kind !== 'new')) reject('unrelated-receiver-shuffle');
  const freshPurchases = ds.filter(d => pm.get(d.id)?.kind === 'new').map(d => {
    const b = bounds(d.blank);
    return { demandId: d.id, lengthMm: b.maxY - b.minY,
      role: (d.cutEdges?.length ? 'transition-starter' : 'straight-filler') as 'transition-starter' | 'straight-filler' };
  });
  if (!freshPurchases.length || ds.some(d => (d.eaveOverlapMm ?? 0) > 1e-7 && pm.get(d.id)?.kind !== 'new')) reject('starter-insufficient');
  const order: string[] = [], complete = new Set<string>(), pending = [...s.placements];
  for (let pass = 0; pending.length && pass <= s.placements.length; pass++) {
    let progress = false;
    for (let i = 0; i < pending.length;) {
      const p = pending[i], source = inventory.get(p.offcutId ?? '')?.sourceDemandId;
      if (p.kind === 'new' || source && complete.has(source)) { order.push(p.demandId); complete.add(p.demandId); pending.splice(i, 1); progress = true; }
      else i++;
    }
    if (!progress) reject('installation-dependency-cycle');
  }
  return { model: PAIRED_RECEIVER_MODEL, inputFingerprint: fingerprint([r.roof, r.faces, r.profile, r.settings]),
    referenceLayoutId, donorLayoutId, proposal: structuredClone(proposal), families: rows.sort((a, b) => a.side.localeCompare(b.side)),
    freshPurchases, coveredDemandIds: ds.map(d => d.id), dependencyOrder: order,
    physicalFingerprint: pairedPhysicalFingerprint(s), purchasedSheets: ledger.totals.newSheets,
    purchasedLinealM: ledger.totals.purchasedLinealM, siteSetoutConfirmed: false };
}

export function validatePairedReceiverCertificate(r: SolveRequest, s: Solution): Issue[] {
  const certificate = s.installationPlan?.pairedReceiver;
  if (!certificate) return [];
  try {
    if (certificate.model !== PAIRED_RECEIVER_MODEL || certificate.referenceLayoutId !== s.installationPlan!.referenceLayoutId ||
      typeof certificate.donorLayoutId !== 'string' || !certificate.donorLayoutId) reject('invalid-paired-certificate');
    const actual = derivePairedReceiverCertificate(r, s, certificate.proposal, certificate.referenceLayoutId, certificate.donorLayoutId);
    if (fingerprint(actual) !== fingerprint(certificate)) reject('stale-paired-certificate');
    return [];
  } catch (error) {
    return [{ severity: 'error', code: 'PAIRED_RECEIVER_FAMILY', message: error instanceof PairedReceiverRejection ? error.code : 'malformed-paired-certificate' }];
  }
}
