import type { BankLayout, Demand, Lap, Offcut, Placement, RoofFace, Solution, SolveRequest } from './types';
import type { SearchHooks } from './solver';
import { dot, fingerprint } from './math';
import { area } from './regions';
import { frameFor, generateDemands, generateFaceDemands, offcutsFrom, sceneToSurface, sheetCount, validateInputs } from './material';
import { matchFaceGrouped } from './matching';
interface FaceInfo { face: RoofFace; span: number; length: number; net: number; offsets: number[]; extra: number }
interface Candidate {
  demands: Demand[]; placements: Placement[]; offcuts: Offcut[]; layout: BankLayout;
  laps: Record<string, Lap>; cost: number; score: number; relationships: number;
}
class BudgetReached extends Error {}
/** Vertex-aligned lanes expose full half-hip runs. Aligning an apex sometimes
 * needs one extra cover cell; it is counted, never hidden by rounding down. */
function offsetsFor(face: RoofFace, request: SolveRequest): number[] {
  if (face.laneOffsetLocked) return [face.laneOffsetMm];
  const w = request.profile.coverMm, frame = frameFor(face, request.roof);
  const xs = face.polygon.map(p => sceneToSurface(p, frame).x), min = Math.min(...xs), span = Math.max(...xs) - min;
  const phase = (x: number): number => { const v = ((w - ((x % w) + w) % w) % w); return v < 1e-6 || w - v < 1e-6 ? 0 : v; };
  const phases = [face.laneOffsetMm, 0, ...xs.map(x => phase(x - min)), phase(span) / 2];
  return phases.filter((x, i, all) => all.findIndex(y => Math.abs(x - y) < 1e-5) === i)
    .filter(x => sheetCount(span, w, x) <= sheetCount(span, w) + 1).slice(0, 12);
}
/** Face sets are geometric hypotheses, not north/south labels. The longest
 * banks are tried first; opposite/adjacent pairs and directional families are
 * alternatives. More than four faces are fully supported within the budget. */
function primarySets(infos: FaceInfo[]): string[][] {
  const sorted = [...infos].sort((a, b) => b.length - a.length || b.net - a.net || a.face.id.localeCompare(b.face.id));
  const sets: string[][] = [], seen = new Set<string>();
  function add(items: FaceInfo[]): void {
    if (!items.length) return;
    const ids = items.map(i => i.face.id).sort(), key = ids.join('|');
    if (!seen.has(key)) { seen.add(key); sets.push(ids); }
  }
  // The leading opposite pair implements the ordinary long-face feeding model.
  const first = sorted[0];
  if (!first) return [];
  const opposite = sorted.find(i => dot(first.face.flow!, i.face.flow!) < -.95);
  if (opposite) add([first, opposite]);
  add(sorted.slice(0, 2));
  for (const i of sorted.slice(0, 4)) {
    const family = sorted.filter(j => Math.abs(dot(i.face.flow!, j.face.flow!)) > .95);
    add(family);
  }
  add([first]);
  for (let i = 0; i < Math.min(sorted.length, 10); i++) {
    for (let j = i + 1; j < Math.min(sorted.length, 10); j++) add([sorted[i], sorted[j]]);
    if (i < 4) add(sorted.slice(0, i + 3));
  }
  for (const i of sorted.slice(1, 6)) add([i]);
  add(sorted);
  return sets;
}
export function optimiseBanks(request: SolveRequest, hooks: SearchHooks = {}): Solution {
  const clock = hooks.now ?? (() => performance.now()), started = clock();
  const issues = validateInputs(request.roof, request.faces, request.profile, request.settings);
  if (issues.some(i => i.severity === 'error')) throw new Error(issues.filter(i => i.severity === 'error').map(i => i.message).join('\n'));
  if (hooks.shouldCancel?.()) throw new Error('Offcut search cancelled.');
  const { roof, faces, profile, settings } = request;
  const baseLayout: BankLayout = { primaryFaceIds: [], laneOffsetByFace: Object.fromEntries(faces.map(f => [f.id, f.laneOffsetMm])), extraLengthByFace: Object.fromEntries(faces.map(f => [f.id, 0])) };
  const baseDemands = generateDemands(roof, faces, profile, settings, baseLayout);
  const baseLaps = Object.fromEntries(faces.map(f => [f.id, f.lap])) as Record<string, Lap>;
  let best: Candidate = { demands: baseDemands, placements: baseDemands.map(d => ({ demandId: d.id, kind: 'new', rotation: 0, translateY: 0 })), offcuts: baseDemands.flatMap(d => offcutsFrom(d, profile)), layout: baseLayout, laps: baseLaps, cost: baseDemands.reduce((n, d) => n + area(d.blank), 0), score: Infinity, relationships: 0 };
  const allNewCost = best.cost;
  const infos = faces.map((face): FaceInfo => {
    const frame = frameFor(face, roof), ps = face.polygon.map(p => sceneToSurface(p, frame));
    const xs = ps.map(p => p.x), ys = ps.map(p => p.y), span = Math.max(...xs) - Math.min(...xs);
    const remainder = span % profile.coverMm;
    // A small, bounded extra stock option deals with registration/cut losses.
    // It is supplied metal, explicitly priced in the objective and reported.
    const geometricMargin = Math.min(remainder, profile.coverMm - remainder) / frame.pitchCos;
    const extra = Math.min(settings.maxBankExtensionMm ?? 100, Math.ceil((geometricMargin + profile.cutGapMm * 2 + profile.lengthIncrementMm) / profile.lengthIncrementMm) * profile.lengthIncrementMm);
    return { face, span, length: Math.max(...ys) - Math.min(...ys), net: baseDemands.filter(d => d.faceId === face.id).reduce((n, d) => n + area(d.cover), 0), offsets: offsetsFor(face, request), extra };
  });
  // Practical-first, not a square-metre competition: fragmentation of a large
  // secondary face costs handling/cutting time. Penalise each large mixed face
  // by two longest-sheet equivalents, while small valley infill is expected.
  // This is a search preference, NOT material added to quantities or orders.
  const largestNet = Math.max(...infos.map(i => i.net));
  const mixedFacePenalty = Math.max(...infos.map(i => i.length)) * (profile.coverMm + profile.leftLapMm + profile.rightLapMm) * 2;
  const choices = primarySets(infos), trials = choices.flatMap(ids => [{ ids, extend: false }, { ids, extend: true }]).slice(0, settings.maxTrials);
  let completed = 0, budgetReached = false;
  const check = (): void => {
    if (hooks.shouldCancel?.()) throw new Error('Offcut search cancelled.');
    if (clock() - started > settings.maxMilliseconds) throw new BudgetReached();
  };
  const cache = new Map<string, Demand[]>();
  function demandsFor(info: FaceInfo, phase: number, primary: boolean, extra: number, lap: Lap): Demand[] {
    const key = `${info.face.id}/${phase}/${primary}/${extra}`;
    let demands = cache.get(key);
    if (!demands) { demands = generateFaceDemands(roof, { ...info.face, laneOffsetMm: phase }, profile, settings, primary, extra); cache.set(key, demands); }
    return demands.map(d => ({ ...d, lap }));
  }
  for (const trial of trials) {
    try {
      check();
      const layout = structuredClone(baseLayout); layout.primaryFaceIds = trial.ids;
      const laps = { ...baseLaps }, demands: Demand[] = [], placements: Placement[] = [], inventory: Offcut[] = [], used = new Set<string>();
      let cost = 0, relationships = 0;
      for (const id of trial.ids) {
        const info = infos.find(i => i.face.id === id)!;
        const extra = trial.extend ? info.extra : 0; layout.extraLengthByFace[id] = extra;
        const ds = demandsFor(info, info.face.laneOffsetMm, true, extra, laps[id]);
        demands.push(...ds); placements.push(...ds.map((d): Placement => ({ demandId: d.id, kind: 'new', rotation: 0, translateY: 0 })));
        inventory.push(...ds.flatMap(d => offcutsFrom(d, profile))); cost += ds.reduce((n, d) => n + area(d.blank), 0);
      }
      // Whole secondary faces are completed before any small leftover-piece pass.
      // Larger targets have first claim on large source offcuts.
      const targets = infos.filter(i => !trial.ids.includes(i.face.id)).sort((a, b) => b.net - a.net || a.face.id.localeCompare(b.face.id));
      for (const info of targets) {
        check();
        const available = inventory.filter(o => !used.has(o.id));
        const lapChoices: Lap[] = settings.optimiseLapDirections && !info.face.lapLocked ? [info.face.lap, info.face.lap === 1 ? -1 : 1] : [info.face.lap];
        let selected: { ds: Demand[]; phase: number; lap: Lap; match: ReturnType<typeof matchFaceGrouped> } | undefined;
        for (const phase of info.offsets) for (const lap of lapChoices) {
          check(); const ds = demandsFor(info, phase, false, 0, lap);
          const match = matchFaceGrouped(ds, available, profile, check);
          if (!selected || match.freshArea < selected.match.freshArea - 1e-3 || Math.abs(match.freshArea - selected.match.freshArea) < 1e-3 &&
            (match.sourceCount < selected.match.sourceCount || match.sourceCount === selected.match.sourceCount && ds.length < selected.ds.length)) selected = { ds, phase, lap, match };
        }
        if (!selected) throw new Error('No valid sheet registration was available.');
        const { ds, phase, lap, match } = selected;
        layout.laneOffsetByFace[info.face.id] = phase; laps[info.face.id] = lap;
        demands.push(...ds); placements.push(...match.placements); cost += match.freshArea; relationships += match.sourceCount;
        for (const id of match.used) used.add(id);
        const fresh = new Set(match.placements.filter(p => p.kind === 'new').map(p => p.demandId));
        inventory.push(...ds.filter(d => fresh.has(d.id)).flatMap(d => offcutsFrom(d, profile)));
      }
      if (demands.length > settings.maxSheets) continue;
      completed++; hooks.onProgress?.(completed, trials.length);
      const mixedLarge = infos.filter(info => {
        if (info.net < largestNet * .25) return false;
        const ids = new Set(demands.filter(d => d.faceId === info.face.id).map(d => d.id));
        const ps = placements.filter(p => ids.has(p.demandId));
        return ps.some(p => p.kind === 'new') && ps.some(p => p.kind === 'reuse');
      }).length;
      const score = cost + mixedLarge * mixedFacePenalty;
      if (cost <= allNewCost + 1e-3 && placements.some(p => p.kind === 'reuse') &&
          (score < best.score - 1e-3 || Math.abs(score - best.score) < 1e-3 && relationships < best.relationships)) {
        // Canonical face/lane ordering makes export validation independent of
        // the particular bank visitation order used by the search.
        const order = new Map(faces.map((f, i) => [f.id, i]));
        demands.sort((a, b) => order.get(a.faceId)! - order.get(b.faceId)! || a.laneIndex - b.laneIndex);
        best = { demands, placements, offcuts: inventory, layout, laps, cost, score, relationships };
      }
    } catch (error) {
      if (error instanceof BudgetReached) { budgetReached = true; break; }
      // A longer candidate bank may exceed a manufacturer's length limit;
      // rejecting that hypothesis must not invalidate a shorter valid fallback.
      if (error instanceof Error && /exceeds the profile maximum|Sheet limit exceeded/.test(error.message)) continue;
      throw error;
    }
  }
  if (!profile.allowEndForEnd) issues.push({ severity: 'warning', code: 'END_FOR_END_RESTRICTED', message: 'End-for-end reuse was not enabled. Hip-to-hip reuse can be restricted; only enable it after checking the selected profile.' });
  for (const info of infos) {
    const extra = best.layout.extraLengthByFace[info.face.id];
    if (extra > 0) issues.push({ severity: 'warning', code: 'EXTRA_CUT_STOCK', faceId: info.face.id, message: `${info.face.name}: angled-cut sheets include ${extra.toFixed(1)} mm extra upstream stock to make reuse possible. This is additional supplied length, not free material; confirm it at site measure.` });
    const count = best.demands.filter(d => d.faceId === info.face.id).length, minimum = sheetCount(info.span, profile.coverMm);
    if (count > minimum) issues.push({ severity: 'warning', code: 'REGISTERED_EXTRA_LANE', faceId: info.face.id, message: `${info.face.name}: ${count} sheet positions (${minimum} by width plus ${count - minimum} for sheet-joint alignment). Every position is allocated new or reused.` });
  }
  if (budgetReached) issues.push({ severity: 'warning', code: 'SEARCH_BUDGET', message: 'Search time limit reached. Showing the best completed, fully covered plan, not a partial calculation.' });
  issues.push({ severity: 'warning', code: 'PROTOTYPE_ONLY', message: 'Draft cut/reuse plan only. Verify roof geometry, profile/lap rules and site-measured lengths before ordering. Spares are not included.' });
  const installed = best.demands.reduce((n, d) => n + area(d.required), 0), baseline = best.demands.reduce((n, d) => n + area(d.blank), 0);
  return {
    schemaVersion: 1, sourceRevision: roof.sourceRevision, facesRevision: fingerprint({ faces, profile, settings }),
    profile: structuredClone(profile), settings: structuredClone(settings), demands: best.demands,
    offcuts: best.offcuts, placements: best.placements.sort((a, b) => a.demandId.localeCompare(b.demandId)), lapByFace: best.laps, bankLayout: best.layout,
    metrics: { newMaterialMm2: best.cost, baselineNewMaterialMm2: baseline, netRoofMm2: best.demands.reduce((n, d) => n + area(d.cover), 0), installedPhysicalMm2: installed,
      wasteMm2: best.cost - installed, savedMm2: baseline - best.cost, newSheetCount: best.placements.filter(p => p.kind === 'new').length, reusedPieceCount: best.placements.filter(p => p.kind === 'reuse').length },
    search: { method: 'bank-first', completedTrials: completed, elapsedMs: clock() - started, budgetReached, provenOptimal: false },
    issues, status: 'prototype-review', orderReady: false,
  };
}
