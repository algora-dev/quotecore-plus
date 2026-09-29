import type { Solution } from './types';
import { area } from './regions';
import { offcutsFrom } from './material';
import { reuseGroups } from './plan';
import { matchFace } from './matching';
import { validateSolution } from './solver';
/** Move a physical set as one REVIEW operation. Target lanes are fixed; the
 * pieces are snapped/reallocated, never scaled/mirrored into a painted triangle.
 * No partial group move or invalid source dependency is silently committed. */
export function moveReuseGroup(solution: Solution, groupId: string, destinationFaceId: string, nearLane?: number): Solution {
  if (validateSolution(solution).length) throw new Error('Correct the existing invalid placement before moving an offcut set.');
  const group = reuseGroups(solution).find(g => g.id === groupId);
  if (!group) throw new Error('Choose an existing offcut set.');
  if (destinationFaceId === group.destinationFaceId) throw new Error('This set is already on that face. Use Advanced to adjust individual cuts.');
  const source = solution.offcuts.filter(o => group.offcutIds.includes(o.id));
  const targets = solution.demands.filter(d => d.faceId === destinationFaceId).sort((a, b) => a.laneIndex - b.laneIndex);
  const windows = targets.map((_, i) => targets.slice(i, i + group.sheetCount)).filter(w => w.length === group.sheetCount);
  if (nearLane !== undefined) windows.sort((a, b) => Math.abs(a[0].laneIndex - nearLane) - Math.abs(b[0].laneIndex - nearLane));
  for (const window of windows) {
    if (window.some((d, i) => i > 0 && d.laneIndex !== window[i - 1].laneIndex + 1)) continue;
    // Do not overwrite a different reusable set. The user must move it first.
    if (window.some(d => solution.placements.find(p => p.demandId === d.id)?.kind !== 'new')) continue;
    const match = matchFace(window, source, solution.profile);
    if (match.placements.some(p => p.kind !== 'reuse') || match.used.size !== source.length) continue;
    const next = structuredClone(solution);
    for (const p of next.placements) if (group.demandIds.includes(p.demandId)) { p.kind = 'new'; delete p.offcutId; p.rotation = 0; p.translateY = 0; p.manual = true; }
    for (const p of match.placements) Object.assign(next.placements.find(q => q.demandId === p.demandId)!, p, { manual: true });
    const fresh = new Set(next.placements.filter(p => p.kind === 'new').map(p => p.demandId));
    // Preserve currently referenced source inventory so invalid dependencies are
    // detectable, and regenerate only real new-sheet inventory for valid moves.
    const usedIds = new Set(next.placements.filter(p => p.kind === 'reuse').map(p => p.offcutId));
    const inventory = next.demands.filter(d => fresh.has(d.id)).flatMap(d => offcutsFrom(d, next.profile));
    for (const o of next.offcuts) if (usedIds.has(o.id) && !inventory.some(q => q.id === o.id)) inventory.push(o);
    next.offcuts = inventory;
    next.metrics.newMaterialMm2 = next.demands.filter(d => fresh.has(d.id)).reduce((n, d) => n + area(d.blank), 0);
    next.metrics.newSheetCount = fresh.size; next.metrics.reusedPieceCount = next.placements.length - fresh.size;
    next.metrics.savedMm2 = next.metrics.baselineNewMaterialMm2 - next.metrics.newMaterialMm2;
    next.metrics.wasteMm2 = next.metrics.newMaterialMm2 - next.metrics.installedPhysicalMm2;
    const errors = validateSolution(next);
    if (errors.length) continue;
    next.issues = [...next.issues.filter(i => i.severity === 'warning'), { severity: 'warning', code: 'MANUAL_GROUP_MOVE', message: 'An offcut set was moved. Vacated sheet positions now require new stock; the material plan and counts have been updated.' }];
    next.status = 'prototype-review'; return next;
  }
  throw new Error('This whole set does not fit the available new-sheet positions with the current lap and source dependencies. Nothing was changed.');
}
