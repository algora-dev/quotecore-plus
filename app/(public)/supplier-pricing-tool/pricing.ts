// Pricing engine v2: Measurement Set + AppliedProducts -> priced lines + totals.
// Handles group-level (Standard) and per-entry (Advanced) applications,
// waste %, labour, qty override, supplier-permitted price override.

import type { AppliedProduct, GroupKey, MeasurementSet, SupplierProduct } from './types';
import { GROUP_DEFS, groupPitchedTotal, entryPitched } from './types';

export interface OutputLine {
  groupKey: GroupKey;
  groupLabel: string;
  /** entry label when per-entry, null when whole group */
  entryLabel: string | null;
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

export interface OutputTotals {
  material: number;
  labour: number;
  lines: OutputLine[];
}

function effectiveQty(ap: AppliedProduct, measured: number): number {
  return ap.qtyOverride != null ? ap.qtyOverride : measured;
}

export function priceOutput(set: MeasurementSet, catalog: SupplierProduct[]): OutputTotals {
  const byId = new Map(catalog.map(p => [p.id, p]));
  const lines: OutputLine[] = [];

  for (const ap of set.appliedProducts) {
    const p = byId.get(ap.productId);
    if (!p) continue;
    const def = GROUP_DEFS.find(d => d.key === ap.groupKey);
    if (!def) continue;
    const group = set.groups[ap.groupKey];

    let measured: number;
    let entryLabel: string | null = null;
    if (ap.entryId == null) {
      measured = groupPitchedTotal(set, ap.groupKey);
    } else {
      const entry = group.entries.find(e => e.id === ap.entryId);
      if (!entry) continue; // entry was deleted - skip
      measured = entryPitched(set, ap.groupKey, ap.entryId);
      entryLabel = entry.label;
    }

    const calcQty = effectiveQty(ap, measured);
    const purchaseQty = calcQty * (1 + (ap.wastePct || 0) / 100);
    const unitPrice = ap.priceOverride != null && p.priceEditable ? ap.priceOverride : p.unitPrice;
    const lineTotal = Math.round(purchaseQty * unitPrice * 100) / 100;
    const labourTotal = Math.round(purchaseQty * (ap.labourRate || 0) * 100) / 100;

    lines.push({
      groupKey: ap.groupKey,
      groupLabel: def.label,
      entryLabel,
      productId: p.id,
      name: p.name,
      code: p.code,
      basisUnit: def.unit,
      calcQty,
      wastePct: ap.wastePct,
      purchaseQty,
      unitPrice,
      lineTotal,
      labourTotal,
    });
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    material: round(lines.reduce((s, l) => s + l.lineTotal, 0)),
    labour: round(lines.reduce((s, l) => s + l.labourTotal, 0)),
    lines,
  };
}

export function fmt(n: number, dp = 2): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
