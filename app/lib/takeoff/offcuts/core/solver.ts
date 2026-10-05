import type { AlternativePlanOptions, AlternativePlanResult, DecisionTrace, PlanObjective, PlanQuality, Demand, Issue, Lap, Offcut, Placement, Solution, SolveRequest } from './types';
import { fingerprint } from './math';
import { area, bounds, rotate180, subtract, translate } from './regions';
import { findFit } from './fit';
export { findFit } from './fit';
import { optimiseBankLayouts } from './banks';
import { rebuildInventory, materialAtDestination } from './inventory';
import { generateDemands, offcutsFrom, validateInputs } from './material';
import { supplyView } from './supply';
import { planQuality, planSignature, comparePlans } from './diagnostics';
export function facesRevision(request: SolveRequest): string {
  return fingerprint({ faces: request.faces, profile: request.profile, settings: request.settings });
}
export interface SearchHooks {
  onProgress?: (completed: number, total: number) => void;
  shouldCancel?: () => boolean; now?: () => number;
  onDecisionTrace?: (trace: DecisionTrace) => void;
  /** Advanced programmatic search policy; profile/face locks remain unchanged. */
  planSearch?: { objective: PlanObjective; attempt?: number; referenceQuality?: PlanQuality;
    excludeSignatures?: string[]; maxExtraMaterialPercent?: number; referenceSolution?: Solution };
}
/** Returns distinct complete layouts, never random reruns of the same plan. */
export function optimiseLayouts(request: SolveRequest, hooks: SearchHooks = {}): Solution[] {
  const solutions = request.settings.stockMode === 'bank-first'
    ? optimiseBankLayouts(request, hooks) : [optimiseLegacy(request, hooks)];
  for (const solution of solutions) {
    solution.issues.push(...validateSolution(solution));
    if (solution.issues.some(i => i.severity === 'error')) solution.status = 'invalid';
  }
  return solutions;
}
export function optimise(request: SolveRequest, hooks: SearchHooks = {}): Solution {
  return optimiseLayouts(request, hooks)[0];
}
/** Search again with a deliberate objective and exclusions. Existing geometry,
 * stock limits, laps and previous accepted plan are not mutated. A repeated or
 * non-improving result is reported honestly rather than relabelled as a new plan. */
export function optimiseAlternative(request: SolveRequest, options: AlternativePlanOptions, hooks: SearchHooks = {}): AlternativePlanResult {
  const { previous, objective } = options;
  if (!['simpler', 'less-material'].includes(objective)) throw new Error('Choose Simpler cut plan or Less material.');
  if (request.settings.stockMode !== 'bank-first') throw new Error('Alternative strategies require primary-bank mode.');
  if (previous.sourceRevision !== request.roof.sourceRevision || previous.facesRevision !== facesRevision(request))
    throw new Error('The previous plan is stale. Confirm the changed roof/settings and calculate a new plan first.');
  if (validateSolution(previous).some(i => i.severity === 'error')) throw new Error('Correct the invalid previous plan before requesting an alternative.');
  if(!previous.bankLayout)throw new Error('Previous plan has no verifiable bank layout.');
  const expected=generateDemands(request.roof,request.faces,request.profile,request.settings,previous.bankLayout)
    .map(d=>({...d,lap:previous.lapByFace[d.faceId]}));
  if(fingerprint(expected)!==fingerprint(previous.demands))throw new Error('Previous sheet geometry does not match the reviewed roof.');
  const cap=options.maxExtraMaterialPercent??15, attempt=options.attempt??0;
  if(!Number.isFinite(cap)||cap<0||cap>100)throw new Error('Simpler-plan material cap must be between 0% and 100%.');
  if(!Number.isInteger(attempt)||attempt<0||attempt>10000)throw new Error('Invalid alternative attempt number.');
  const exclusions=[...new Set([planSignature(previous),...(options.excludedSignatures??[])])];
  if(exclusions.length>128)throw new Error('Too many previous layouts in one search session.');
  const previousQuality=planQuality(previous);
  let trace:DecisionTrace|undefined;
  const solutions=optimiseLayouts(request,{...hooks,planSearch:{objective,attempt,referenceQuality:previousQuality,
    excludeSignatures:exclusions,maxExtraMaterialPercent:cap,referenceSolution:previous},onDecisionTrace:t=>{trace=t;hooks.onDecisionTrace?.(t);}});
  const solution=solutions.find(s=>s.status!=='invalid'&&!exclusions.includes(planSignature(s)));
  if(solution){
    const comparison=comparePlans(previous,solution,objective);
    // Independent result gate: objective labels must describe a real improvement.
    const improved=objective==='simpler'?comparison.complexityDelta<0&&solution.metrics.newMaterialMm2<=previousQuality.suppliedMm2*(1+cap/100)+1
      :comparison.suppliedDeltaMm2 < -1;
    if(improved&&comparison.changedFaceIds.length){
      solution.comparison=comparison;
      return{status:'found',solution,comparison,trace:solution.decisionTrace!,message:objective==='simpler'
        ?'Found a distinct plan with a lower site-complexity score. Review its material difference.'
        :'Found a distinct plan requiring less purchased material. Review the changed cutting sequence.'};
    }
  }
  if(!trace)throw new Error('Alternative search produced no diagnostic trace.');
  return{status:'no-better-distinct-plan',solution:null,comparison:null,trace,
    message:objective==='simpler'?`No distinct simpler plan was found within the search budget and ${cap}% extra-material limit. Your current plan has been kept.`
      :'No distinct lower-material plan was found within the search budget. Your current plan has been kept. This is not proof of an optimum.'};
}
export function optimiseLegacy(request: SolveRequest, hooks: SearchHooks = {}): Solution {
  const clock = hooks.now ?? (() => performance.now()), started = clock();
  const issues = validateInputs(request.roof, request.faces, request.profile, request.settings);
  const errors = issues.filter(i => i.severity === 'error'); if (errors.length) throw new Error(errors.map(i => i.message).join('\n'));
  const baseDemands = generateDemands(request.roof, request.faces, request.profile, request.settings);
  const byId = new Map(baseDemands.map(d => [d.id, d]));
  const baseline = baseDemands.reduce((n, d) => n + area(d.blank), 0);
  const faceIds = request.faces.map(f => f.id), baseLaps = Object.fromEntries(request.faces.map(f => [f.id, f.lap])) as Record<string, Lap>;
  const movable = request.faces.filter(f => !f.lapLocked).map(f => f.id);
  const masks: Record<string, Lap>[] = [baseLaps];
  if (request.settings.optimiseLapDirections && request.profile.allowEndForEnd) {
    // Bounded alternatives, not exponential exhaustive search. A fixed face lap
    // is respected by every sheet assigned to that face.
    for (let k = 0; k < Math.min(12, movable.length); k++) masks.push({ ...baseLaps, [movable[k]]: baseLaps[movable[k]] === 1 ? -1 : 1 });
    masks.push(Object.fromEntries(faceIds.map((id, i) => [id, movable.includes(id) && i % 2 ? -baseLaps[id] : baseLaps[id]])) as Record<string, Lap>);
    masks.push(Object.fromEntries(faceIds.map((id, i) => [id, movable.includes(id) && i % 2 === 0 ? -baseLaps[id] : baseLaps[id]])) as Record<string, Lap>);
  }
  const lengthOf = (d: Demand): number => { const b = bounds(d.blank); return b.maxY - b.minY; };
  const orderings = [
    [...baseDemands].sort((a, b) => lengthOf(b) - lengthOf(a) || a.id.localeCompare(b.id)),
    [...baseDemands].sort((a, b) => area(b.blank) - area(a.blank) || a.id.localeCompare(b.id)),
    [...baseDemands].sort((a, b) => a.faceId.localeCompare(b.faceId) || lengthOf(b) - lengthOf(a)),
    [...baseDemands].sort((a, b) => lengthOf(a) - lengthOf(b) || a.id.localeCompare(b.id)),
  ];
  // Baseline is a fully-covered fallback, so a timeout can never leave a
  // partially-filled roof masquerading as a complete material requirement.
  let bestPlacements: Placement[] = baseDemands.map(d => ({ demandId: d.id, kind: 'new', rotation: 0, translateY: 0 }));
  let bestOffcuts = baseDemands.flatMap(d => offcutsFrom(d, request.profile));
  let bestLaps = baseLaps, bestCost = baseline, completed = 0, budgetReached = false;
  const total = Math.min(request.settings.maxTrials, masks.length * orderings.length);
  outer: for (let trial = 0; trial < total; trial++) {
    if (hooks.shouldCancel?.()) throw new Error('Offcut search cancelled.');
    if (clock() - started > request.settings.maxMilliseconds) { budgetReached = true; break; }
    // Interleave lap configurations so a modest budget still tries lap changes.
    const laps = masks[trial % masks.length], order = orderings[Math.floor(trial / masks.length) % orderings.length];
    const inventory: Offcut[] = [], used = new Set<string>(), placements: Placement[] = [];
    let cost = 0;
    for (let index = 0; index < order.length; index++) {
      if (hooks.shouldCancel?.()) throw new Error('Offcut search cancelled.');
      if (clock() - started > request.settings.maxMilliseconds) { budgetReached = true; break outer; }
      const original = order[index], d = { ...original, lap: laps[original.faceId] };
      let fit: Placement | null = null, score = Infinity;
      for (let oi = 0; oi < inventory.length; oi++) {
        if (oi % 32 === 0 && clock() - started > request.settings.maxMilliseconds) { budgetReached = true; break outer; }
        const o = inventory[oi]; if (used.has(o.id)) continue;
        const candidate = findFit(o, d, request.profile); if (!candidate) continue;
        const waste = area(o.region) - area(d.required);
        if (waste < score) { score = waste; fit = candidate; }
      }
      if (fit) { placements.push(fit); used.add(fit.offcutId!); }
      else {
        placements.push({ demandId: d.id, kind: 'new', rotation: 0, translateY: 0 });
        cost += area(d.blank); inventory.push(...offcutsFrom(d, request.profile));
      }
    }
    completed++; hooks.onProgress?.(completed, total);
    if (cost < bestCost - 1e-4) { bestCost = cost; bestPlacements = placements; bestOffcuts = inventory; bestLaps = laps; }
  }
  const demands = baseDemands.map(d => ({ ...d, lap: bestLaps[d.faceId] }));
  const installed = demands.reduce((n, d) => n + area(d.required), 0);
  const solution: Solution = {
    schemaVersion: 1, sourceRevision: request.roof.sourceRevision, facesRevision: facesRevision(request),
    profile: structuredClone(request.profile), settings: structuredClone(request.settings), demands,
    offcuts: bestOffcuts, placements: bestPlacements.sort((a, b) => a.demandId.localeCompare(b.demandId)), lapByFace: bestLaps,
    metrics: { newMaterialMm2: bestCost, baselineNewMaterialMm2: baseline,
      netRoofMm2: demands.reduce((n, d) => n + area(d.cover), 0), installedPhysicalMm2: installed,
      wasteMm2: Math.max(0, bestCost - installed), savedMm2: Math.max(0, baseline - bestCost),
      newSheetCount: bestPlacements.filter(p => p.kind === 'new').length, reusedPieceCount: bestPlacements.filter(p => p.kind === 'reuse').length },
    search: { method: 'bounded-multistart', completedTrials: completed, elapsedMs: clock() - started, budgetReached, provenOptimal: false },
    issues: [...issues, { severity: 'warning', code: 'PROTOTYPE_ONLY', message: 'Geometric prototype only. Profile rules, buildability and real roof dimensions need roofer approval; this is not an ordering/cutting instruction.' }],
    status: 'prototype-review', orderReady: false,
  };
  // Independently recheck every proposed placement and source dependency.
  solution.issues.push(...validateSolution(solution));
  if (solution.issues.some(i => i.severity === 'error')) solution.status = 'invalid';
  void byId;
  return solution;
}
export function placedRegion(s: Solution, p: Placement) {
  const o = s.offcuts.find(o => o.id === p.offcutId); if (!o) return [];
  return translate(p.rotation === 180 ? rotate180(o.region, o.widthMm) : o.region, 0, p.translateY);
}
export function validateSolution(s: Solution): Issue[] {
  const issues: Issue[] = [], demandMap = new Map(s.demands.map(d => [d.id, d])), offcutMap = new Map(s.offcuts.map(o => [o.id, o]));
  const rebuilt = rebuildInventory(s.demands, s.placements, s.profile);
  const canonicalOffcuts = new Map(rebuilt.offcuts.map(o => [o.id, o]));
  const counts = new Map<string, number>(), used = new Set<string>(), fresh = new Set(s.placements.filter(p => p.kind === 'new').map(p => p.demandId));
  const error = (code: string, message: string, id?: string): void => { issues.push({ severity: 'error', code, message, objectId: id }); };
  if (rebuilt.unresolved.length) error('CUT_DEPENDENCY', 'A cut chain has a cycle or missing source operation.', rebuilt.unresolved[0]);
  if (demandMap.size !== s.demands.length || offcutMap.size !== s.offcuts.length) error('DUPLICATE_ID', 'Duplicate sheet or offcut IDs.');
  // Rebuild the physical inventory independently, including the configured cut
  // clearance. Matching a bounding box or forging a second ID cannot create metal.
  for (const o of s.offcuts) {
    const expected = canonicalOffcuts.get(o.id);
    if (!expected || o.sourceDemandId !== expected.sourceDemandId || o.sourceFaceId !== expected.sourceFaceId ||
        o.lap !== expected.lap || o.parentOffcutId !== expected.parentOffcutId ||
        o.rootDemandId !== expected.rootDemandId || o.rootBankId !== expected.rootBankId ||
        o.cutSetId !== expected.cutSetId || o.cutKind !== expected.cutKind || o.generation !== expected.generation ||
        o.sourceLaneIndex !== expected.sourceLaneIndex || o.sourceCrossMm !== expected.sourceCrossMm || Math.abs(o.widthMm - expected.widthMm) > 1e-6 ||
        area(subtract(o.region, expected.region)) + area(subtract(expected.region, o.region)) > 1e-3) {
      error('INVENTORY_MISMATCH', 'The offcut does not match the source sheet and its actual cut-clearance inventory.', o.id);
    }
  }
  let freshArea = 0;
  for (const p of s.placements) {
    counts.set(p.demandId, (counts.get(p.demandId) ?? 0) + 1);
    const d = demandMap.get(p.demandId); if (!d) { error('UNKNOWN_TARGET', 'A placement references an unknown sheet lane.', p.demandId); continue; }
    if (d.lap !== s.lapByFace[d.faceId]) error('FACE_LAP', 'All sheets on a face must have the same lap direction.', d.id);
    if (p.kind === 'new') {
      const b=bounds(d.blank),width=s.profile.coverMm+s.profile.leftLapMm+s.profile.rightLapMm;
      if(!Number.isFinite(area(d.blank)) || Math.abs(b.minX)>1e-6 || Math.abs(b.maxX-width)>1e-6 ||
        b.maxY-b.minY>s.profile.maxLengthMm+1e-6 || b.maxY<=b.minY ||
        Math.abs(area(d.blank)-width*(b.maxY-b.minY))>1e-3)
        error('NEW_STOCK_SIZE','New supply must be a whole physical rectangular sheet within the profile length limit.',d.id);
      if(area(subtract(d.required,d.blank))>Math.max(1e-3,area(d.required)*1e-9))
        error('NEW_STOCK_COVERAGE','The ordered new sheet is too short for its required cut.',d.id);
      freshArea += area(d.blank); continue;
    }
    const o = offcutMap.get(p.offcutId ?? '');
    if (!o) { error('UNKNOWN_OFFCUT', 'The source offcut does not exist.', d.id); continue; }
    if (used.has(o.id)) error('DOUBLE_USE', 'The same physical offcut is assigned more than once.', o.id); used.add(o.id);
    const source = demandMap.get(o.sourceDemandId);
    const sourcePlacement = s.placements.find(p => p.demandId === o.sourceDemandId);
    const parent = offcutMap.get(sourcePlacement?.offcutId ?? '');
    const stock = source && fresh.has(source.id) ? source.blank
      : parent && sourcePlacement ? materialAtDestination(parent, sourcePlacement) : [];
    if (!source || !stock.length || area(subtract(o.region, subtract(stock, source.required))) > 1e-3)
      error('INVALID_SOURCE_GEOMETRY', 'An offcut extends outside its actual source metal / cut chain.', o.id);
    if (Math.abs(o.widthMm - d.widthMm) > 1e-6) error('PROFILE_WIDTH', 'Source and destination physical sheet widths differ.', d.id);
    if (p.rotation !== 0 && p.rotation !== 180) error('ROTATION', 'Only 0° or approved end-for-end rotation is allowed.', d.id);
    if (p.rotation === 180 && !s.profile.allowEndForEnd) error('ROTATION', 'End-for-end rotation is disabled for this profile.', d.id);
    if ((p.rotation === 180 ? -o.lap : o.lap) !== d.lap) error('LAP_CONFLICT', 'The reused piece laps the wrong way on the destination face.', d.id);
    if (!Number.isFinite(p.translateY)) error('PLACEMENT_TRANSFORM', 'Invalid placement translation.', d.id);
    else if (area(subtract(d.required, placedRegion(s, p))) > Math.max(1e-3, area(d.required) * 1e-9)) error('PIECE_TOO_SMALL', 'The moved offcut leaves part of this sheet requirement uncovered.', d.id);
  }
  for (const d of s.demands) if (counts.get(d.id) !== 1) error('COVERAGE', 'Every required sheet lane must have exactly one new/reused allocation.', d.id);
  if (s.engineVersion === '2.4') {
    for (const faceId of new Set(s.demands.map(d=>d.faceId))) {
      const bank=s.demands.find(d=>d.faceId===faceId)?.materialBankId;
      const roots=new Set(s.placements.filter(p=>p.kind==='reuse' && demandMap.get(p.demandId)?.faceId===faceId)
        .map(p=>offcutMap.get(p.offcutId??'')?.rootBankId).filter(id=>id && id!==bank));
      if (roots.size>1) error('MULTI_BANK_MOSAIC', 'A face cannot mix unrelated external material banks in the practical layout.',faceId);
    }
  }
  if (s.engineVersion === '2.5' || s.engineVersion === '2.6' || s.engineVersion === '2.7') {
    const view=supplyView(s);
    for(const faceId of new Set(s.demands.map(d=>d.faceId))){
      const external=new Set(s.placements.filter(p=>p.kind==='reuse'&&demandMap.get(p.demandId)?.faceId===faceId)
        .map(p=>view.blockByPlacement.get(p.demandId)).filter(id=>id&&!view.blocks.find(b=>b.id===id)?.faceIds.includes(faceId)));
      if(external.size>(s.settings.maxSourceBlocksPerFace??2)){
        issues.push({severity:s.placements.some(p=>p.manual)?'warning':'error',code:'FRAGMENTED_SOURCES',faceId,
          message:'This face uses more independent cutting blocks than the practical source limit. Review the grouped allocation.'});
      }
    }
  }
  const installed = s.demands.reduce((n, d) => n + area(d.required), 0);
  if (freshArea + 1e-3 < installed) error('MATERIAL_CONSERVATION', 'Installed physical material exceeds the new material supplied.');
  if (Math.abs(freshArea - s.metrics.newMaterialMm2) > Math.max(1e-3, freshArea * 1e-9)) error('STALE_TOTALS', 'Material totals do not match the current placements.');
  const expectedTotals: Record<string, number> = {
    baselineNewMaterialMm2: s.demands.reduce((n, d) => n + area(d.blank), 0),
    netRoofMm2: s.demands.reduce((n, d) => n + area(d.cover), 0),
    installedPhysicalMm2: installed,
    wasteMm2: freshArea - installed,
    newSheetCount: s.placements.filter(p => p.kind === 'new').length,
    reusedPieceCount: s.placements.filter(p => p.kind === 'reuse').length,
  };
  expectedTotals.savedMm2 = expectedTotals.baselineNewMaterialMm2 - freshArea;
  for (const [key, expected] of Object.entries(expectedTotals)) {
    const actual = s.metrics[key as keyof typeof s.metrics];
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > Math.max(1e-3, Math.abs(expected) * 1e-9)) {
      error('STALE_TOTALS', `The ${key} total does not match the current physical allocations.`);
    }
  }
  return issues;
}
