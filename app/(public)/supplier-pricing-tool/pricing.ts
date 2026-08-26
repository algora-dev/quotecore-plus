// Pricing engine: Measurement Set + catalog -> priced output lines + totals.
// Phase 1: Standard mode, group-level products, waste %, baseline pricing.

import type { GroupKey, MeasurementSet, SupplierProduct } from './types';
import { GROUP_DEFS, groupTotal } from './types';

export interface OutputLine {
  groupKey: GroupKey;
  groupLabel: string;
  productId: string;
  name: string;
  code: string;
  basisUnit: string;
  calcQty: number;      // measured quantity
  wastePct: number;
  purchaseQty: number;  // waste-adjusted
  unitPrice: number;
  lineTotal: number;
}

export interface OutputTotals {
  material: number;
  lines: OutputLine[];
}

export function priceOutput(set: MeasurementSet, catalog: SupplierProduct[]): OutputTotals {
  const byId = new Map(catalog.map(p => [p.id, p]));
  const lines: OutputLine[] = [];
  for (const def of GROUP_DEFS) {
    const group = set.groups[def.key];
    if (group.entries.length === 0) continue;
    const total = groupTotal(set, def.key);
    for (const pid of group.productIds) {
      const p = byId.get(pid);
      if (!p) continue;
      const wastePct = set.applied[pid]?.wastePct ?? p.defaultWastePct;
      const purchaseQty = total * (1 + wastePct / 100);
      lines.push({
        groupKey: def.key,
        groupLabel: def.label,
        productId: pid,
        name: p.name,
        code: p.code,
        basisUnit: def.unit,
        calcQty: total,
        wastePct,
        purchaseQty,
        unitPrice: p.unitPrice,
        lineTotal: Math.round(purchaseQty * p.unitPrice * 100) / 100,
      });
    }
  }
  const material = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  return { material, lines };
}

export function fmt(n: number, dp = 2): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
