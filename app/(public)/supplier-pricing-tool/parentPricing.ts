// Pricing engine for parent-model trades v2 (cladding / flooring):
// buckets -> components -> measurement entries, with one or MORE products
// per component (layered: cedar timber + battens + building wrap on the
// same measured m2). Mirrors pricing.ts semantics per applied product.

import type { ComponentApplied, ParentJob, ParentBasis, SupplierProduct, CustomComponent } from './types';
import { componentTotal, PARENT_BASIS_UNIT } from './types';

export interface ParentOutputLine {
  componentId: string;
  componentName: string;
  bucketId: string;
  bucketName: string;
  basis: ParentBasis;
  productId: string;
  name: string;
  code: string;
  basisUnit: string;
  calcQty: number;      // measured quantity (after override if set)
  wastePct: number;
  purchaseQty: number;  // waste-adjusted
  unitPrice: number;    // effective (after override if honoured)
  lineTotal: number;    // material
  labourTotal: number;
}

export interface ParentOutputTotals {
  material: number;
  labour: number;
  lines: ParentOutputLine[];
  customs: CustomComponent[];
  customMaterial: number;
  customLabour: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function priceParentOutput(job: ParentJob, catalog: SupplierProduct[]): ParentOutputTotals {
  const byId = new Map(catalog.map(p => [p.id, p]));
  const lines: ParentOutputLine[] = [];

  for (const ap of job.applied) {
    const p = byId.get(ap.productId);
    const comp = job.components.find(c => c.id === ap.componentId);
    if (!p || !comp) continue;
    const bucket = job.parents.find(b => b.id === comp.parentId);
    if (!bucket) continue;

    const measured = componentTotal(job, ap.componentId);
    const calcQty = ap.qtyOverride != null ? ap.qtyOverride : measured;
    const purchaseQty = calcQty * (1 + (ap.wastePct || 0) / 100);
    const unitPrice = ap.priceOverride != null && p.priceEditable ? ap.priceOverride : p.unitPrice;

    lines.push({
      componentId: comp.id,
      componentName: comp.name,
      bucketId: bucket.id,
      bucketName: bucket.name,
      basis: comp.basis,
      productId: p.id,
      name: p.name,
      code: p.code,
      basisUnit: PARENT_BASIS_UNIT[comp.basis],
      calcQty,
      wastePct: ap.wastePct || 0,
      purchaseQty,
      unitPrice,
      lineTotal: round(purchaseQty * unitPrice),
      labourTotal: round(purchaseQty * (ap.labourRate || 0)),
    });
  }

  const customMaterial = round(job.customComponents.reduce((s, c) => s + c.quantity * c.unitPrice, 0));
  const customLabour = round(job.customComponents.reduce((s, c) => s + c.quantity * c.labourRate, 0));

  return {
    material: round(lines.reduce((s, l) => s + l.lineTotal, 0)) + customMaterial,
    labour: round(lines.reduce((s, l) => s + l.labourTotal, 0)) + customLabour,
    lines,
    customs: job.customComponents,
    customMaterial,
    customLabour,
  };
}
