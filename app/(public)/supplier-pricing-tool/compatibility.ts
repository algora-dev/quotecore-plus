// Roof-compatibility layer (Burton system): every product can carry
// roofTypes (['all'] default) and a family. The covering(s) the user
// applies to Roof Areas define the "active" roof types and family;
// every later component group filters by roof type and highlights
// same-family products as Recommended.

import type { AppliedProduct, GroupKey, SupplierProduct } from './types';

/** Product component categories - mirrors how Shaun categorises supplier lists. */
export type ProductComponent =
  | 'covering'
  | 'underlay'
  | 'fixing'
  | 'ridge'
  | 'hip'
  | 'valley'
  | 'barge'
  | 'gutter'
  | 'downpipe';

export function productRoofTypes(p: SupplierProduct): string[] {
  return p.roofTypes && p.roofTypes.length > 0 ? p.roofTypes : ['all'];
}

/** Coverings currently applied to Roof Areas (group-level or per-entry). */
export function appliedCoverings(catalog: SupplierProduct[], applied: AppliedProduct[]): SupplierProduct[] {
  const ids = new Set(
    applied.filter(ap => ap.groupKey === ('roofAreas' as GroupKey)).map(ap => ap.productId),
  );
  return catalog.filter(p => ids.has(p.id) && (p.component ?? 'covering') === 'covering');
}

/** Roof types implied by the chosen covering(s). Empty = nothing chosen yet
 *  (no covering applied) - compatibility filtering stays open. */
export function activeRoofTypes(catalog: SupplierProduct[], applied: AppliedProduct[]): string[] {
  const set = new Set<string>();
  for (const c of appliedCoverings(catalog, applied)) {
    for (const t of productRoofTypes(c)) if (t !== 'all') set.add(t);
  }
  return [...set];
}

/** Family of the chosen covering(s) when they all share one; else null. */
export function activeFamily(catalog: SupplierProduct[], applied: AppliedProduct[]): string | null {
  const coverings = appliedCoverings(catalog, applied).filter(c => c.family);
  if (coverings.length === 0) return null;
  const fam = coverings[0].family!;
  return coverings.every(c => c.family === fam) ? fam : null;
}

/** Is a product valid for the active roof types? Open when no covering chosen. */
export function isRoofCompatible(p: SupplierProduct, active: string[]): boolean {
  if (active.length === 0) return true;
  const types = productRoofTypes(p);
  return types.includes('all') || types.some(t => active.includes(t));
}

/** Should this product be highlighted as Recommended? */
export function isRecommended(p: SupplierProduct, family: string | null): boolean {
  if (family && p.family === family) return true;
  return p.suggested === true;
}
