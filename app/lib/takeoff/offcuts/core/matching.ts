import type { Demand, Offcut, Placement, Profile } from './types';
import { area } from './regions';
import { findFit } from './fit';
export interface FaceMatch { placements: Placement[]; freshArea: number; used: Set<string>; sourceCount: number }
/** Minimum-cost assignment for one whole destination face, with explicit new-
 * sheet dummy columns. Unlike greedy first-fit, an augmenting path can release
 * a scarce large piece for the lane that needs it. No physical offcut is split
 * between destinations or used twice. Zero runtime dependencies. */
export function matchFace(demands: Demand[], inventory: Offcut[], profile: Profile, check: () => void = () => {}): FaceMatch {
  const n = demands.length, m = inventory.length + n;
  if (!n) return { placements: [], freshArea: 0, used: new Set(), sourceCount: 0 };
  const fits: (Placement | null)[][] = [];
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    check();
    const d = demands[i], row: number[] = [], candidate: (Placement | null)[] = [];
    for (let j = 0; j < inventory.length; j++) {
      if (j % 32 === 0) check();
      const fit = findFit(inventory[j], d, profile); candidate.push(fit);
      // Millimetres of new stock is the material objective; tiny residual
      // tie-breaking favours snug fits without buying unnecessary extra sheets.
      row.push(fit ? Math.max(0, area(inventory[j].region) - area(d.required)) / d.widthMm * 1e-8 + j * 1e-10 : 1e12);
    }
    for (let j = 0; j < n; j++) row.push(area(d.blank) / d.widthMm);
    fits.push(candidate); cost.push(row);
  }
  // Rectangular Hungarian shortest augmenting path (rows <= columns).
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    check(); p[0] = i;
    let j0 = 0;
    const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const columns = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) columns[p[j] - 1] = j - 1;
  let freshArea = 0; const used = new Set<string>(), sources = new Set<string>();
  const placements = demands.map((d, i): Placement => {
    const j = columns[i], fit = fits[i][j];
    if (j >= 0 && j < inventory.length && fit) { used.add(inventory[j].id); sources.add(inventory[j].sourceFaceId); return fit; }
    freshArea += area(d.blank); return { demandId: d.id, kind: 'new', rotation: 0, translateY: 0 };
  });
  return { placements, freshArea, used, sourceCount: sources.size };
}
/** Practical roofers keep a cut set coherent: one source face feeds one
 * destination face, and straight new sheets fill the remainder. A destination
 * is never mosaiced from unrelated source banks. We only claim a relationship
 * when the coherent source replaces a meaningful share of the destination;
 * otherwise the face remains new material and its own cuts can feed later faces. */
export function matchFaceGrouped(demands: Demand[], inventory: Offcut[], profile: Profile, check: () => void): FaceMatch {
  const allNew = matchFace(demands, [], profile, check);
  const sourceIds = [...new Set(inventory.map(o => o.sourceFaceId))];
  let best = allNew;
  let bestReuseCount = 0;
  for (const id of sourceIds) {
    check();
    const candidate = matchFace(demands, inventory.filter(o => o.sourceFaceId === id), profile, check);
    const reuseCount = candidate.placements.filter(p => p.kind === 'reuse').length;
    const reuseRatio = demands.length ? reuseCount / demands.length : 0;
    // One-sheet faces can sensibly be supplied by one cut. For larger faces,
    // require a substantial coherent contribution instead of scattering scraps.
    const meaningful = demands.length <= 2 ? reuseCount > 0 : reuseRatio >= 0.35;
    if (!meaningful) continue;
    if (candidate.freshArea < best.freshArea - 1e-3 ||
        Math.abs(candidate.freshArea - best.freshArea) < 1e-3 && reuseCount > bestReuseCount) {
      best = candidate; bestReuseCount = reuseCount;
    }
  }
  return best;
}
