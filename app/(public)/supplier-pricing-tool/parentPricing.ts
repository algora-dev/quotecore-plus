// Pricing engine for parent-model trades (cladding / flooring): one product
// per parent area, covering every measured area under it. Mirrors pricing.ts
// semantics (waste %, labour, qty override, price override when editable).

import type { ParentApplied, ParentJob, SupplierProduct, CustomComponent } from './types';
import { parentTotal } from './types';

export interface ParentOutputLine {
  parentId: string;
  parentName: string;
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
    const parent = job.parents.find(x => x.id === ap.parentId);
    if (!p || !parent) continue;

    const measured = parentTotal(job, ap.parentId);
    const calcQty = ap.qtyOverride != null ? ap.qtyOverride : measured;
    const purchaseQty = calcQty * (1 + (ap.wastePct || 0) / 100);
    const unitPrice = ap.priceOverride != null && p.priceEditable ? ap.priceOverride : p.unitPrice;

    lines.push({
      parentId: ap.parentId,
      parentName: parent.name,
      productId: p.id,
      name: p.name,
      code: p.code,
      basisUnit: 'm\u00B2',
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
