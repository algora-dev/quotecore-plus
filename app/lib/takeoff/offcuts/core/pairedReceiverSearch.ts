/** Optional, transactional V2.26 receiver allocation. The main solver and its
 * objectives never call this module. Both complete source families, the fresh
 * bridge and downstream recuts are changed together, or nothing is accepted. */
import type { Demand, Lap, Offcut, Placement, Solution, SolveRequest } from './types';
import { area, fitY, rotate180 } from './regions';
import { generateDemands } from './material';
import { rebuildInventory } from './inventory';
import { coverPhase } from './installationAnchors';
import { matchCoherentSets } from './coherentMatching';
import { protectValleyReceivers, recalculateMetrics } from './receiverSafety';
import { validateDraft } from './editing';
import { fingerprint } from './math';
import { planSignature } from './diagnostics';
import { coherentWorkflow } from './globalBanks';
import {
  derivePairedReceiverCertificate, facesReceiverHip, pairedReceiverOpportunities,
  physicalCutFamilies, PAIRED_RECEIVER_POLICY, PairedReceiverRejection,
  type PairedReceiverOpportunity, type PairedReceiverProposal, type PhysicalCutFamily, type ReceiverEnd,
} from './pairedReceiverFamilies';

export interface PairedReceiverSearchReport {
  model: 'paired-receiver-search-v1'; donorLayoutId: string;
  opportunities: number; familyAssignmentsTried: number; completeProposals: number;
  transactionsTried: number; validatedCount: number; bounded: boolean;
  rejected: Record<string, number>; selectedLayoutIds: string[];
}
export interface PairedReceiverSearchResult { plans: Solution[]; report: PairedReceiverSearchReport }
interface Candidate {
  proposal: PairedReceiverProposal; opportunity: PairedReceiverOpportunity;
  families: [PhysicalCutFamily, PhysicalCutFamily]; placements: Placement[];
  lap: Lap; freshCost: number;
}
const fresh = (demandId: string): Placement => ({ demandId, kind: 'new', rotation: 0, translateY: 0 });

function endPlacement(ds: Demand[], family: PhysicalCutFamily, end: ReceiverEnd, lap: Lap,
  r: SolveRequest, clearance: number): Placement[] | null {
  if (ds.length < family.pieces.length) return null;
  const targets = end.side === 'negative-u' ? ds.slice(0, family.pieces.length) : ds.slice(-family.pieces.length);
  if (targets.some(d => (d.eaveOverlapMm ?? 0) > 1e-7 || !d.cutEdges?.some(e => e.id === end.hipEdgeId))) return null;
  for (const rotation of (r.profile.allowEndForEnd ? [0, 180] : [0]) as (0 | 180)[]) {
    const ordered = rotation === 180 ? [...targets].reverse() : targets, result: Placement[] = [];
    for (let i = 0; i < family.pieces.length; i++) {
      const o = family.pieces[i], d = ordered[i];
      if ((rotation === 180 ? -o.lap : o.lap) !== lap || Math.abs(o.widthMm - d.widthMm) > 1e-6 || !facesReceiverHip(o, rotation, end)) break;
      const need = d.required.map(b => ({ ...b, top0: b.top0 - clearance, top1: b.top1 - clearance,
        bottom0: b.bottom0 + clearance, bottom1: b.bottom1 + clearance }));
      const stock = rotation === 180 ? rotate180(o.region, o.widthMm) : o.region;
      const y = fitY(stock, need, 'lower');
      if (y === null) break;
      result.push({ demandId: d.id, kind: 'reuse', offcutId: o.id, rotation, translateY: y });
    }
    if (result.length === family.pieces.length) return result;
  }
  return null;
}

function regenerate(r: SolveRequest, s: Solution) {
  s.demands = generateDemands(r.roof, r.faces, r.profile, r.settings, s.bankLayout).map(d => ({ ...d, lap: s.lapByFace[d.faceId] }));
}
function inventory(s: Solution) {
  const result = rebuildInventory(s.demands, s.placements, s.profile);
  if (result.unresolved.length) throw new PairedReceiverRejection('unresolved-cut-dependencies');
  s.offcuts = result.offcuts;
}

function transact(r: SolveRequest, seed: Solution, c: Candidate, check: () => void): Solution {
  check();
  const s = structuredClone(seed), layout = s.bankLayout!;
  const affected = new Set([c.opportunity.faceId, ...c.opportunity.ends.flatMap(e => e.downstreamFaceIds)]);
  const originalDemands = new Map(seed.demands.map(d => [d.id, d]));
  const originalCuts = new Map(seed.offcuts.map(o => [o.id, o]));
  const imported = new Set(c.families.flatMap(f => f.pieces.map(o => o.id)));
  // The optional receiver transaction cannot silently disturb lower banks or
  // their dependency trees. A larger affected scope requires a separate plan.
  for (const p of seed.placements.filter(p => p.kind === 'reuse')) {
    if (affected.has(originalDemands.get(p.demandId)!.faceId)) continue;
    const o = originalCuts.get(p.offcutId ?? '');
    if (o && (affected.has(o.sourceFaceId) || imported.has(o.id))) throw new PairedReceiverRejection('dependent-face-outside-paired-scope');
  }
  delete s.installationPlan!.pairedReceiver;
  delete s.stockLengthRefinement; delete s.globalDonorSearch; delete s.provisionalReuse; delete s.comparison;
  if (s.decisionTrace) s.decisionTrace.historic = true;
  if (layout.stockEndRefinement) {
    const kept = layout.stockEndRefinement.demandIds.filter(id => !affected.has(originalDemands.get(id)?.faceId ?? ''));
    if (kept.length) layout.stockEndRefinement.demandIds = kept; else delete layout.stockEndRefinement;
  }
  layout.laneOffsetByFace[c.opportunity.faceId] = c.proposal.phaseMm;
  s.lapByFace[c.opportunity.faceId] = c.lap;
  regenerate(r, s);
  const old = new Map(seed.placements.map(p => [p.demandId, p]));
  s.placements = s.demands.map(d => affected.has(d.faceId) ? fresh(d.id) : old.get(d.id) ?? fresh(d.id));
  const assignments = new Map(c.placements.map(p => [p.demandId, p]));
  s.placements = s.placements.map(p => assignments.get(p.demandId) ?? p);
  inventory(s);
  // Consume actual recuts first. Remaining positions may use coherent unused
  // original donor sets, never invented secondary stock or a spent ancestor.
  for (let endIndex = 0; endIndex < c.opportunity.ends.length; endIndex++) {
    const end = c.opportunity.ends[endIndex], parentIds = new Set(c.families[endIndex].pieces.map(o => o.id));
    for (const faceId of end.downstreamFaceIds) {
      check(); const face = r.faces.find(f => f.id === faceId)!;
      const laps: Lap[] = r.settings.optimiseLapDirections && !face.lapLocked ? [face.lap, face.lap === 1 ? -1 : 1] : [face.lap];
      const used = new Set(s.placements.filter(p => p.kind === 'reuse').map(p => p.offcutId));
      const secondary = s.offcuts.filter(o => !used.has(o.id) && o.sourceFaceId === c.opportunity.faceId && parentIds.has(o.parentOffcutId ?? ''));
      const original = s.offcuts.filter(o => !used.has(o.id) && !o.parentOffcutId &&
        seed.installationPlan!.donorFaceIds.includes(o.sourceFaceId));
      let best: { ps: Placement[]; lap: Lap; cost: number; secondaryCount: number } | undefined;
      for (const lap of laps) {
        check(); const ds = s.demands.filter(d => d.faceId === faceId).map(d => ({ ...d, lap }));
        const second = matchCoherentSets(ds, secondary, s.profile, check, false, 2);
        const provided = new Set(second.placements.filter(p => p.kind === 'reuse').map(p => p.demandId));
        const top = matchCoherentSets(ds.filter(d => !provided.has(d.id)), original, s.profile, check, false, 2);
        const pm = new Map([...second.placements.filter(p => p.kind === 'reuse'), ...top.placements].map(p => [p.demandId, p]));
        const ps = ds.map(d => pm.get(d.id) ?? fresh(d.id));
        const freshIds = new Set(ps.filter(p => p.kind === 'new').map(p => p.demandId));
        const cost = ds.filter(d => freshIds.has(d.id)).reduce((n, d) => n + area(d.blank), 0);
        const secondaryCount = provided.size;
        // Prefer useful intended descendants, then less purchased material. Do
        // not describe an unrelated first-generation shuffle as secondary reuse.
        if (!best || secondaryCount > best.secondaryCount || secondaryCount === best.secondaryCount && cost < best.cost)
          best = { ps, lap, cost, secondaryCount };
      }
      if (best) {
        s.lapByFace[faceId] = best.lap;
        s.demands = s.demands.map(d => d.faceId === faceId ? { ...d, lap: best!.lap } : d);
        const changes = new Map(best.ps.map(p => [p.demandId, p]));
        s.placements = s.placements.map(p => changes.get(p.demandId) ?? p); inventory(s);
      }
    }
  }
  check(); protectValleyReceivers(r, s, () => { check(); return false; });
  recalculateMetrics(s); inventory(s);
  // Parent/child rules and the existing coupled-valley safety remain hard gates.
  s.engineVersion = '2.26';
  s.installationPlan!.reuseEndTrimMm = 0;
  s.installationPlan!.pairedReceiver = derivePairedReceiverCertificate(r, s, c.proposal,
    s.installationPlan!.referenceLayoutId, planSignature(seed));
  const errors = validateDraft({ schemaVersion: 1, ...r, solution: s }).filter(i => i.severity === 'error');
  if (errors.length) throw new PairedReceiverRejection('physical-validation:' + [...new Set(errors.map(i => i.code))].join(','));
  const nowDemands = new Map(s.demands.map(d => [d.id, d]));
  if (seed.placements.some(p => !affected.has(originalDemands.get(p.demandId)!.faceId) &&
    (fingerprint(p) !== fingerprint(s.placements.find(q => q.demandId === p.demandId)) ||
      fingerprint(originalDemands.get(p.demandId)) !== fingerprint(nowDemands.get(p.demandId)))))
    throw new PairedReceiverRejection('unrelated-bank-changed');
  s.layoutLabel = 'Reversed banks — paired hip families'; s.objective = 'installation';
  s.layoutId = planSignature(s); s.orderReady = false; s.status = 'prototype-review';
  s.issues = s.issues.filter(i => i.severity !== 'error');
  return s;
}

/** Bounded proposal generation evaluates both family-to-end permutations.
 * A cover-based setout offset is measured from a real junction, not an invented
 * roof vertex. Offsets are explicit; neither end is claimed to be exactly on a
 * sheet boundary unless its recorded offset is zero. Locked phases stay locked. */
export function searchPairedReceiverFamilies(r: SolveRequest, seed: Solution, check: () => void = () => {}): PairedReceiverSearchResult {
  const report: PairedReceiverSearchReport = { model: 'paired-receiver-search-v1', donorLayoutId: planSignature(seed),
    opportunities: 0, familyAssignmentsTried: 0, completeProposals: 0, transactionsTried: 0,
    validatedCount: 0, bounded: false, rejected: {}, selectedLayoutIds: [] };
  const reject = (code: string) => { report.rejected[code] = (report.rejected[code] ?? 0) + 1; };
  if (!seed.bankLayout || seed.installationPlan?.kind !== 'reversed-donors' || seed.installationPlan.donorFaceIds.length !== 2)
    return { plans: [], report: { ...report, rejected: { 'requires-two-reversed-donors': 1 } } };
  const rebuilt = rebuildInventory(seed.demands, seed.placements, seed.profile);
  if (rebuilt.unresolved.length) return { plans: [], report: { ...report, rejected: { 'unresolved-seed-inventory': 1 } } };
  const canonical = { ...seed, offcuts: rebuilt.offcuts };
  const opportunities = pairedReceiverOpportunities(r, seed.installationPlan.donorFaceIds, seed.installationPlan.receiverFaceIds);
  report.opportunities = opportunities.length;
  if (!opportunities.length) { reject('unavailable-receiver-ends'); return { plans: [], report }; }
  const families = physicalCutFamilies(canonical, seed.installationPlan.donorFaceIds);
  const proposals: Candidate[] = [], signatures = new Set<string>();
  // This is a conservative fitting envelope, not extra purchasable metal and
  // not a promise of spare trimming room after the descendants have been cut.
  const clearance = Math.min(100, Math.max(20, r.profile.cutGapMm * 2));
  for (const opportunity of opportunities) {
    const face = r.faces.find(f => f.id === opportunity.faceId)!;
    const laps: Lap[] = r.settings.optimiseLapDirections && !face.lapLocked ? [face.lap, face.lap === 1 ? -1 : 1] : [face.lap];
    const phases = opportunity.ends.flatMap(end => Array.from({ length: face.laneOffsetLocked ? 1 : PAIRED_RECEIVER_POLICY.phaseDivisions }, (_, i) => {
      const phase = face.laneOffsetLocked ? face.laneOffsetMm : coverPhase(end.anchor.phaseMm + i * r.profile.coverMm / PAIRED_RECEIVER_POLICY.phaseDivisions, r.profile.coverMm);
      return { phase, anchor: end.anchor, offset: coverPhase(phase - end.anchor.phaseMm, r.profile.coverMm) };
    }));
    for (const registration of phases) {
      check(); const layout = structuredClone(seed.bankLayout); layout.laneOffsetByFace[face.id] = registration.phase;
      if (layout.stockEndRefinement) {
        const old = new Map(seed.demands.map(d => [d.id, d.faceId]));
        const ids = layout.stockEndRefinement.demandIds.filter(id => old.get(id) !== face.id);
        if (ids.length) layout.stockEndRefinement.demandIds = ids; else delete layout.stockEndRefinement;
      }
      const ds = generateDemands(r.roof, r.faces, r.profile, r.settings, layout).filter(d => d.faceId === face.id).sort((a, b) => a.laneIndex - b.laneIndex);
      for (const lap of laps) for (const first of families) for (const second of families) {
        if (first.donorFaceId === second.donorFaceId) continue;
        check(); report.familyAssignmentsTried++;
        const a = endPlacement(ds, first, opportunity.ends[0], lap, r, clearance);
        const b = a && endPlacement(ds, second, opportunity.ends[1], lap, r, clearance);
        if (!a || !b) { reject('whole-family-end-or-lap-no-fit'); continue; }
        const ps = [...a, ...b], ids = new Set(ps.map(p => p.demandId));
        if (ids.size !== ps.length) { reject('overlapping-receiver-families'); continue; }
        const key = fingerprint([registration.phase, lap, ps]); if (signatures.has(key)) continue; signatures.add(key);
        const proposal: PairedReceiverProposal = { receiverFaceId: face.id, phaseMm: registration.phase,
          registrationAnchorId: registration.anchor.id, phaseOffsetMm: registration.offset, fittingClearanceMm: clearance,
          families: [{ familyId: first.id, endId: opportunity.ends[0].id }, { familyId: second.id, endId: opportunity.ends[1].id }] };
        proposals.push({ proposal, opportunity, families: [first, second], placements: ps, lap,
          freshCost: ds.filter(d => !ids.has(d.id)).reduce((n, d) => n + area(d.blank), 0) });
      }
    }
  }
  report.completeProposals = proposals.length;
  proposals.sort((a, b) => a.freshCost - b.freshCost || a.proposal.phaseOffsetMm - b.proposal.phaseOffsetMm || fingerprint(a.proposal).localeCompare(fingerprint(b.proposal)));
  const bounded = proposals.slice(0, PAIRED_RECEIVER_POLICY.maximumProposals);
  report.bounded = bounded.length < proposals.length;
  const plans: Solution[] = [], seen = new Set<string>();
  for (const c of bounded) {
    if (report.transactionsTried >= PAIRED_RECEIVER_POLICY.maximumTransactions) { report.bounded = true; break; }
    check(); report.transactionsTried++;
    try {
      const plan = transact(r, seed, c, check); report.validatedCount++;
      if (!seen.has(plan.layoutId!)) { seen.add(plan.layoutId!); plans.push(plan); }
    } catch (error) {
      if (error instanceof PairedReceiverRejection) reject(error.code); else throw error;
    }
  }
  if (!proposals.length) reject('no-complete-paired-placement');
  plans.sort((a, b) => coherentWorkflow(a).score - coherentWorkflow(b).score || a.metrics.newMaterialMm2 - b.metrics.newMaterialMm2 || a.layoutId!.localeCompare(b.layoutId!));
  const selected = plans.slice(0, PAIRED_RECEIVER_POLICY.maximumReturned);
  report.selectedLayoutIds = selected.map(s => s.layoutId!);
  return { plans: selected, report };
}
