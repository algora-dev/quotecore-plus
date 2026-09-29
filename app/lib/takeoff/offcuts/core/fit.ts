import type { Demand, Offcut, Placement, Profile } from './types';
import { area, fitY, rotate180 } from './regions';
export function findFit(o: Offcut, d: Demand, profile: Profile): Placement | null {
  if (Math.abs(o.widthMm - d.widthMm) > 1e-6 || area(o.region) + 1e-4 < area(d.required)) return null;
  for (const rotation of (profile.allowEndForEnd && profile.rulesConfirmed ? [0, 180] : [0]) as (0 | 180)[]) {
    if ((rotation === 180 ? -o.lap : o.lap) !== d.lap) continue;
    const available = rotation === 180 ? rotate180(o.region, o.widthMm) : o.region;
    const translateY = fitY(available, d.required);
    if (translateY !== null) return { demandId: d.id, kind: 'reuse', offcutId: o.id, rotation, translateY };
  }
  return null;
}
