'use client';

import { useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcSelect } from '@/app/components/ui/v2/QcField';
import { formatCurrency } from '@/app/lib/currency/currencies';
import type { QuoteComponentRow, QuoteRoofAreaRow } from '@/app/lib/types';

/**
 * Whole-job → area movers (owner 2026-11-16): multi-select unassigned
 * components and assign them to a work area in ONE batch. Two surfaces share
 * this panel: inside a work area (fixed target) and on the Whole job view
 * (area picker). Moving only reassigns the component — measurements, rates
 * and entries ride along untouched.
 */
export function WholeJobMovePanel({
  components,
  areas,
  currency,
  busy,
  onMove,
  fixedTargetAreaId,
  fixedTargetLabel,
}: {
  components: QuoteComponentRow[];
  areas: QuoteRoofAreaRow[];
  currency: string;
  busy?: boolean;
  onMove: (componentIds: string[], areaId: string) => Promise<void>;
  /** Area view: fixed destination area, no picker. */
  fixedTargetAreaId?: string;
  fixedTargetLabel?: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [targetId, setTargetId] = useState(areas[0]?.id ?? '');
  const [moving, setMoving] = useState(false);
  const working = busy || moving;
  const pickerMode = !fixedTargetAreaId;
  const count = components.length;
  const selectedCount = checked.size;
  const allSelected = selectedCount === count;
  const target = pickerMode ? targetId : fixedTargetAreaId ?? '';

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function move() {
    if (!target || selectedCount === 0) return;
    setMoving(true);
    try {
      await onMove([...checked], target);
      setChecked(new Set());
    } finally {
      setMoving(false);
    }
  }

  const label = pickerMode
    ? `Move${selectedCount ? ` ${selectedCount}` : ''} to area →`
    : `Move${selectedCount ? ` ${selectedCount}` : ''} to ${fixedTargetLabel} →`;

  return <div className="qb-move-panel" data-qc-component="WholeJobMove">
    <div className="qb-move-head">
      <div>
        <span className="qb-guided-kicker">Whole job</span>
        <strong>{count === 1 ? '1 component is not in a work area yet' : `${count} components are not in a work area yet`}</strong>
        <p>Tick the {count === 1 ? 'one' : 'ones'} that belong {pickerMode ? 'in a work area' : `in ${fixedTargetLabel}`} and move {count === 1 ? 'it' : 'them'} across — measurements move with {count === 1 ? 'it' : 'them'}.</p>
      </div>
      <QcButton size="sm" variant="ghost" disabled={working} onClick={() => setChecked(allSelected ? new Set() : new Set(components.map(c => c.id)))}>
        {allSelected ? 'Clear all' : 'Select all'}
      </QcButton>
    </div>
    <ul className="qb-move-rows">
      {components.map(c => (
        <li key={c.id}>
          <label className="qb-move-row" data-checked={checked.has(c.id) || undefined}>
            <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} disabled={working} />
            <span className="qb-move-name">{c.name}</span>
            <span className="qb-move-cost">{formatCurrency(Number(c.material_cost ?? 0) + Number(c.labour_cost ?? 0), currency)}</span>
          </label>
        </li>
      ))}
    </ul>
    <div className="qb-move-foot">
      <span>{selectedCount === 0 ? 'Nothing selected yet' : `${selectedCount} of ${count} selected`}</span>
      {pickerMode && (
        <QcSelect value={targetId} onChange={e => setTargetId(e.target.value)} disabled={working || selectedCount === 0}
          aria-label="Move to work area">
          {areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </QcSelect>
      )}
      <QcButton variant="primary" size="sm" pending={working} disabled={selectedCount === 0 || !target} onClick={() => void move()}>
        {label}
      </QcButton>
    </div>
  </div>;
}
