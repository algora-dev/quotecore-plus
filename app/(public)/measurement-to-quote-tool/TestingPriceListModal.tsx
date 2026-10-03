'use client';

import { useState } from 'react';
import type { BuilderComponent, UnitSystem } from './types';
import { lenLabel, areaLabel } from './types';
import { GuidedComponentEditor } from './GuidedComponentEditor';
import { TESTING_PRICE_LIST, toComponent, type TestingPriceItem } from './testingPriceList';

interface TestingPriceListModalProps {
  unitSystem: UnitSystem;
  /** true = the user already has components; "use" replaces them. */
  hasExisting: boolean;
  onUse: (components: BuilderComponent[]) => void;
  onClose: () => void;
}

function settingsLine(c: TestingPriceItem, len: string, areaU: string): string {
  const unit = c.measurementType === 'area' ? areaU : c.measurementType === 'lineal' ? len : 'ea';
  const parts: string[] = [];
  if (c.pricingStrategy !== 'per_unit' && c.packPrice != null && c.packSize != null) {
    parts.push(`$${c.packPrice} per ${c.packSize}${len} pack`);
    if (c.labourRate > 0) parts.push(`$${c.labourRate}/${len} labour`);
  } else {
    if (c.materialRate > 0) parts.push(`$${c.materialRate} material`);
    if (c.labourRate > 0) parts.push(`$${c.labourRate} labour`);
    parts.push(`per ${unit}`);
  }
  if (c.wasteType === 'percent') parts.push(`+${c.wasteValue}% waste`);
  else if (c.wasteType === 'fixed') parts.push(`+$${c.wasteValue} waste`);
  if (c.pitchEnabled && c.pitchType !== 'none') {
    parts.push(c.pitchType === 'rafter' ? 'rafter pitch factor' : 'hip/valley pitch factor');
  }
  return parts.join(' · ');
}

/**
 * QuoteCore+ testing price list (owner 2026-10-03): six roofing pricing
 * components with testing rates, each shown HOW it is built so users learn
 * the component model by example. Every item is editable with the same
 * editor used for their own components; "Use this price list" loads the
 * (possibly edited) set into the session. Flow-first build - the external
 * UX agent restyles to the v2 standard.
 */
export function TestingPriceListModal({ unitSystem, hasExisting, onUse, onClose }: TestingPriceListModalProps) {
  const [items, setItems] = useState<TestingPriceItem[]>(TESTING_PRICE_LIST);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const len = lenLabel(unitSystem);
  const areaU = areaLabel(unitSystem);

  function handleEditSave(c: BuilderComponent) {
    if (editingIndex == null) return;
    setItems(prev => prev.map((it, i) => (i === editingIndex ? { ...c, howItWorks: it.howItWorks } : it)));
    setEditingIndex(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="QuoteCore+ testing price list">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">QuoteCore+ testing price list</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Six ready-made roofing pricing components with testing rates. See how each one is built,
              change anything, then use them as your starting point - saved to this session only.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="mt-0.5 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {items.map((c, i) => (
            <div key={c.id} className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <button type="button" onClick={() => setEditingIndex(i)} className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900">
                  Edit
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.measurementType === 'lineal' ? `Linear (${len})` : c.measurementType === 'area' ? `Area (${areaU})` : 'Quantity (ea)'} · {settingsLine(c, len, areaU)}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{c.howItWorks}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => onUse(items.map(toComponent))}
            className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            {hasExisting ? 'Replace my components with this list' : 'Use this price list'}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Rates are testing values - edit anything before or after you use them. Nothing is saved outside this session.
          </p>
        </div>
      </div>

      {editingIndex != null && (
        <GuidedComponentEditor
          key={items[editingIndex].id}
          initial={items[editingIndex]}
          unitSystem={unitSystem}
          guided
          onSave={(c) => handleEditSave(c)}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
