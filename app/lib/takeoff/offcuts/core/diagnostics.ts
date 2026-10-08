import type { DecisionTrace, PlanComparison, PlanQuality, Solution, TraceEvent } from './types';
import { fingerprint } from './math';
import { area, bounds, subtract } from './regions';
import { materialAtDestination } from './inventory';
import { supplyView } from './supply';

type Plan = Pick<Solution, 'demands' | 'placements' | 'offcuts' | 'bankLayout'>;
/** Search instrumentation is bounded and never writes plan data to the console,
 * a network service, localStorage or a telemetry vendor. */
export class DecisionRecorder {
  readonly events: TraceEvent[] = [];
  droppedEvents = 0;
  private bytes = 0;
  constructor(private readonly limit = 1500) {}
  add(action: string, message: string, faceIds?: string[], data?: Record<string, unknown>): void {
    const size=JSON.stringify([action,message,faceIds,data]).length;
    if (this.events.length >= this.limit || this.bytes+size>2_000_000) { this.droppedEvents++; return; }
    this.bytes+=size;
    this.events.push({ step: this.events.length + 1, action, message,
      ...(faceIds ? { faceIds: [...faceIds] } : {}), ...(data ? { data: structuredClone(data) } : {}) });
  }
}
/** This signature ignores labels, colours, timing and enumeration order. It
 * requires changed physical supply/assignment, not a different random seed. */
export function planSignature(s: Plan): string {
  const cuts = new Map(s.offcuts.map(o => [o.id, o]));
  const demands = new Map(s.demands.map(d => [d.id, d]));
  const quant = (n: number) => Math.round(n / 5); // 5 mm, not cosmetic floating-point changes
  return fingerprint(s.placements.map(p => {
    const d = demands.get(p.demandId)!, o = cuts.get(p.offcutId ?? ''), b = bounds(d.blank);
    return [d.faceId, d.laneIndex, quant(d.origin.x), p.kind,
      p.kind === 'new' ? quant(b.maxY - b.minY) : [o?.rootDemandId, o?.sourceDemandId, o?.cutSetId, p.rotation, quant(p.translateY)]];
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
export function planQuality(s: Plan): PlanQuality {
  const ds = new Map(s.demands.map(d => [d.id, d])), os = new Map(s.offcuts.map(o => [o.id, o]));
  const view = supplyView(s), relationships = new Set<string>(), sets = new Map<string, Set<string>>();
  let suppliedMm2 = 0, newSheets = 0, reusedPositions = 0, recutOperations = 0, reuseRuns = 0, fillerSeparators = 0;
  const ps = new Map(s.placements.map(p => [p.demandId, p]));
  for (const p of s.placements) {
    const d = ds.get(p.demandId)!;
    if (p.kind === 'new') { newSheets++; suppliedMm2 += area(d.blank); continue; }
    reusedPositions++; const o = os.get(p.offcutId ?? ''); if (!o) continue;
    const operation=s.bankLayout?.primaryOperations?.find(op=>op.faceIds.includes(o.sourceFaceId));
    if(!view.continuationDemandIds.has(d.id))relationships.add(`${operation?.id??o.sourceFaceId}->${d.faceId}`);
    const set = o.cutSetId ?? o.sourceFaceId, dest = sets.get(set) ?? new Set<string>();
    dest.add(d.faceId); sets.set(set, dest);
    // Actual extra trimming of received metal. A proxy, not a blade-cut count.
    if (area(subtract(materialAtDestination(o, p), d.required)) > Math.max(1, area(d.required) * .00001)) recutOperations++;
  }
  for (const face of new Set(s.demands.map(d => d.faceId))) {
    let previous = '', previousFiller = false;
    for (const d of s.demands.filter(d => d.faceId === face).sort((a, b) => a.laneIndex - b.laneIndex)) {
      const p = ps.get(d.id), o = os.get(p?.offcutId ?? '');
      const tag = p?.kind === 'reuse' ? `${o?.sourceFaceId}/${o?.cutSetId}/${p.rotation}` : '';
      if (tag && tag !== previous) reuseRuns++;
      const filler = view.fillerDemandIds.has(d.id);
      if (filler && !previousFiller) fillerSeparators++;
      previous = tag; previousFiller = filler;
    }
  }
  const splitSets = [...sets.values()].reduce((n, destinations) => n + Math.max(0, destinations.size - 1), 0);
  const primaryOperations = view.blocks.filter(b => b.rootDemandIds.some(id => !view.fillerDemandIds.has(id))).length;
  // Public, stable coefficients; no made-up efficiency or confidence percentage.
  const complexity = relationships.size * 8 + reuseRuns * 3 + splitSets * 5 + recutOperations + fillerSeparators * 2 + primaryOperations * 2;
  return { suppliedMm2, newSheets, reusedPositions, sourceRelationships: relationships.size, reuseRuns,
    splitSets, recutOperations, fillerSeparators, primaryOperations, complexity };
}
export function comparePlans(previous: Solution, proposed: Solution, objective: 'simpler' | 'less-material'): PlanComparison {
  const a = planQuality(previous), b = planQuality(proposed);
  const faceSignature = (s: Solution, id: string) => planSignature({ ...s, placements: s.placements.filter(p => s.demands.find(d => d.id === p.demandId)?.faceId === id) });
  return { objective, previousLayoutId: previous.layoutId ?? planSignature(previous), previous: a, proposed: b,
    suppliedDeltaMm2: b.suppliedMm2 - a.suppliedMm2, newSheetDelta: b.newSheets - a.newSheets, complexityDelta: b.complexity - a.complexity,
    changedFaceIds: [...new Set(proposed.demands.map(d => d.faceId))].filter(id => faceSignature(previous, id) !== faceSignature(proposed, id)) };
}
export function traceText(trace: DecisionTrace): string {
  const header = [`Find Offcuts ${trace.engineVersion} — ${trace.objective}`, `Request: ${trace.requestFingerprint}`,
    `Selected trial: ${trace.selectedTrial ?? 'none'}; budget reached: ${trace.budgetReached}`, 'Complexity proxy: 8×relationships + 3×reuse runs + 5×split sets + recut operations + 2×filler separators + 2×primary operations.'];
  if (trace.historic) header.push('HISTORIC: the plan was manually edited after this search.');
  for (const e of trace.events) header.push(`\n${String(e.step).padStart(3, '0')} ${e.action}: ${e.message}`, e.faceIds?.join(', ') ?? '', e.data ? JSON.stringify(e.data, null, 2) : '');
  header.push('\nCANDIDATE COMPARISON', JSON.stringify(trace.candidates, null, 2));
  if (trace.truncated) header.push(`${trace.droppedEvents} detailed events omitted by the trace size limit.`);
  return header.join('\n');
}
