// Product assignment step: one step per populated measurement group.
// Standard: products applied to the WHOLE group. Advanced (persistent toggle):
// per-entry assignment + product editor (labour, waste, qty override,
// price override when the supplier allows it).

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppliedProduct, GroupDef, MeasurementSet, Mode, SupplierProduct } from './types';
import { GROUP_DEFS, groupPitchedTotal, entryPitched, makeId, applyWaste } from './types';
import { activeFamily, activeRoofTypes, isRoofCompatible, isRecommended } from './compatibility';
import { useSupplierConfig } from './supplierConfig';

const inputCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

export function ProductStep({
  def,
  measureSet,
  catalog,
  setMeasureSet,
  mode,
  onBack,
  onNext,
  stepNum,
  totalSteps,
  hideNav = false,
}: {
  def: GroupDef;
  measureSet: MeasurementSet;
  catalog: SupplierProduct[];
  setMeasureSet: (s: MeasurementSet) => void;
  mode: Mode;
  onBack: () => void;
  onNext: () => void;
  stepNum: number;
  totalSteps: number;
  /** Fast mode: hide the per-group Back/Next nav (parent renders its own) */
  hideNav?: boolean;
}) {
  const group = measureSet.groups[def.key];
  const [search, setSearch] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null); // null = group, entryId = per-entry
  const [editing, setEditing] = useState<AppliedProduct | null>(null);
  const { config: supplierCfg } = useSupplierConfig();
  const cur = supplierCfg.currency;
  // Embedded (merged flow): entry rows live in the GroupCard above - the
  // summary card would duplicate them, so it only renders standalone.
  const showSummary = !hideNav;

  // EVERY product for this group stays visible and selectable - compatibility
  // only affects ordering and the "other roof types" tag, never hides items.
  const valid = useMemo(
    () => catalog.filter(p => p.groups.includes(def.key)),
    [catalog, def.key],
  );
  // items not matching the chosen roof type - listed last, still clickable
  const incompatible = useMemo(
    () => {
      const active = activeRoofTypes(catalog, measureSet.appliedProducts);
      if (def.key === 'roofAreas' || active.length === 0) return [];
      return catalog.filter(p => p.groups.includes(def.key) && !isRoofCompatible(p, active));
    },
    [catalog, def.key, measureSet.appliedProducts],
  );
  const family = activeFamily(catalog, measureSet.appliedProducts);
  const filtered = valid.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  const total = groupPitchedTotal(measureSet, def.key);
  const groupApplied = measureSet.appliedProducts.filter(ap => ap.groupKey === def.key && ap.entryId == null);
  const activeRoofs = activeRoofTypes(catalog, measureSet.appliedProducts);

  // Auto-apply default (recommended) products once per group when the user
  // has not applied anything themselves - the "override tick box" behaviour:
  // defaults pre-ticked, user can remove or swap them.
  const autoAddedRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoAddedRef.current === def.key) return;
    const anyForGroup = measureSet.appliedProducts.some(ap => ap.groupKey === def.key);
    if (anyForGroup) return;
    // never auto-pick a covering - that choice is the user's; and on Roof
    // Areas wait until a covering has been chosen so defaults match the roof type.
    // Only COMPATIBLE items ever auto-apply - incompatible ones stay manual.
    const defaults = valid.filter(p =>
      isRecommended(p, family) && (p.component ?? 'covering') !== 'covering' &&
      (activeRoofs.length === 0 || isRoofCompatible(p, activeRoofs)),
    );
    if (def.key === 'roofAreas' && activeRoofs.length === 0) return;
    if (defaults.length === 0) return;
    autoAddedRef.current = def.key;
    const next = [...measureSet.appliedProducts];
    for (const p of defaults) {
      next.push({
        id: makeId('ap'),
        groupKey: def.key,
        productId: p.id,
        entryId: null,
        wastePct: p.defaultWastePct,
        wasteFlat: 0,
        wasteMode: 'percent',
        labourRate: p.defaultLabourRate,
        qtyOverride: null,
        priceOverride: null,
      });
    }
    setMeasureSet({ ...measureSet, appliedProducts: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.key]);

  function applyProduct(pid: string, entryId: string | null) {
    // toggle: clicking an already-applied product removes it (override tick box)
    const already = measureSet.appliedProducts.find(
      ap => ap.groupKey === def.key && ap.productId === pid && (ap.entryId ?? null) === (entryId ?? null),
    );
    if (already) { removeApplied(already.id); return; }
    const p = catalog.find(x => x.id === pid)!;
    const ap: AppliedProduct = {
      id: makeId('ap'),
      groupKey: def.key,
      productId: pid,
      entryId,
      wastePct: p.defaultWastePct,
      wasteFlat: 0,
      wasteMode: 'percent',
      labourRate: p.defaultLabourRate,
      qtyOverride: null,
      priceOverride: null,
    };
    setMeasureSet({ ...measureSet, appliedProducts: [...measureSet.appliedProducts, ap] });
    // Keep the picker open so multiple products can be added back-to-back
    // without re-clicking "+ Product". Search stays so the user can keep
    // filtering; already-added products show an "Added" state.
  }

  function removeApplied(apId: string) {
    setMeasureSet({ ...measureSet, appliedProducts: measureSet.appliedProducts.filter(a => a.id !== apId) });
  }

  function updateApplied(apId: string, patch: Partial<AppliedProduct>) {
    setMeasureSet({
      ...measureSet,
      appliedProducts: measureSet.appliedProducts.map(a => a.id === apId ? { ...a, ...patch } : a),
    });
  }

  const hasAnyApplied = measureSet.appliedProducts.some(ap => ap.groupKey === def.key);

  return (
    <div className="space-y-4">
      {/* Group summary - standalone mode only (embedded mode shows the
          live entry rows in the GroupCard above instead) */}
      {showSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{def.label}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} - measured total{' '}
                <span className="font-semibold text-slate-900">{total.toFixed(1)} {def.unit}</span>
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              {stepNum} of {totalSteps}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {group.entries.map(e => (
              <span key={e.id} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                {e.label}: {(e.value * (e.quantity || 1)).toFixed(0)} {def.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Standard: group-level applications */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Products for this group</h3>
          <button
            onClick={() => setPickerFor(pickerFor === '__group__' ? null : '__group__')}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 cursor-pointer"
          >
            {pickerFor === '__group__' ? 'Done' : '+ Add product'}
          </button>
        </div>
        {def.key !== 'roofAreas' && activeRoofs.length > 0 && (
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{activeRoofs.join(' / ')}-compatible</span>{' items shown first'}
            {family && (<span>{' - '}<span className="font-semibold text-slate-700">{family}</span>{' items highlighted as Recommended'}</span>)}
            {' - every product stays selectable'}
          </p>
        )}

        {groupApplied.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-3">
            No products applied to this group yet. Add one or more.
          </p>
        )}

        {groupApplied.map(ap => {
          const p = catalog.find(x => x.id === ap.productId)!;
          if (!p) return null;
          return (
            <AppliedRow
              key={ap.id}
              ap={ap}
              p={p}
              def={def}
              measured={total}
              advanced={mode === 'advanced'}
              onEdit={() => setEditing(ap)}
              onRemove={() => removeApplied(ap.id)}
              onUpdate={patch => updateApplied(ap.id, patch)}
              cur={cur}
            />
          );
        })}

        {pickerFor === '__group__' && (
          <ProductPicker
            products={filtered}
            def={def}
            cur={cur}
            family={family}
            incompatible={incompatible}
            activeRoofs={activeRoofs}
            search={search}
            setSearch={setSearch}
            onPick={pid => applyProduct(pid, null)}
            appliedIds={new Set(groupApplied.map(ap => ap.productId))}
            onDone={() => setPickerFor(null)}
          />
        )}
      </div>

      {/* Advanced: per-entry assignment */}
      {mode === 'advanced' && group.entries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Per-entry assignment (Advanced)</h3>
          <p className="text-xs text-slate-500 -mt-1">
            Apply products to individual entries - e.g. a different ridge product on a specific ridge.
            Group-level products above still apply to the whole group.
          </p>
          {group.entries.map(entry => {
            const entryApplied = measureSet.appliedProducts.filter(
              ap => ap.groupKey === def.key && ap.entryId === entry.id,
            );
            return (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {entry.label} <span className="font-normal text-slate-400">- {entryPitched(measureSet, def.key, entry.id).toFixed(1)} {def.unit}</span>
                  </span>
                  <button
                    onClick={() => setPickerFor(pickerFor === entry.id ? null : entry.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 transition cursor-pointer"
                  >
                    {pickerFor === entry.id ? 'Done' : '+ Product'}
                  </button>
                </div>
                {entryApplied.map(ap => {
                  const p = catalog.find(x => x.id === ap.productId)!;
                  if (!p) return null;
                  return (
                    <AppliedRow
                      key={ap.id}
                      ap={ap}
                      p={p}
                      def={def}
                      measured={entryPitched(measureSet, def.key, entry.id)}
                      advanced={mode === 'advanced'}
                      onEdit={() => setEditing(ap)}
                      onRemove={() => removeApplied(ap.id)}
                      onUpdate={patch => updateApplied(ap.id, patch)}
                      cur={cur}
                    />
                  );
                })}
                {pickerFor === entry.id && (
                  <ProductPicker
                    products={filtered}
                    def={def}
                    cur={cur}
                    family={family}
                    incompatible={incompatible}
                    activeRoofs={activeRoofs}
                    search={search}
                    setSearch={setSearch}
                    onPick={pid => applyProduct(pid, entry.id)}
                    appliedIds={new Set(entryApplied.map(ap => ap.productId))}
                    onDone={() => setPickerFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hideNav && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={onBack} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!hasAnyApplied}
            className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
          >
            {stepNum === totalSteps ? 'Generate output' : 'Next'}
          </button>
        </div>
      )}

      {editing && (
        <ProductEditorModal
          ap={editing}
          p={catalog.find(x => x.id === editing.productId)!}
          def={def}
          cur={cur}
          onClose={() => setEditing(null)}
          onSave={patch => { updateApplied(editing.id, patch); setEditing(null); }}
        />
      )}
    </div>
  );
}

/** One applied product row: name, qty, waste, live totals, edit/remove. */
function AppliedRow({ ap, p, def, measured, advanced, onEdit, onRemove, onUpdate, cur }: {
  ap: AppliedProduct;
  p: SupplierProduct;
  def: GroupDef;
  measured: number;
  advanced: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<AppliedProduct>) => void;
  cur: string;
}) {
  const calcQty = ap.qtyOverride != null ? ap.qtyOverride : measured;
  const purchaseQty = applyWaste(ap, calcQty);
  const unitPrice = ap.priceOverride != null && p.priceEditable ? ap.priceOverride : p.unitPrice;
  const mat = purchaseQty * unitPrice;
  const lab = purchaseQty * (ap.labourRate || 0);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/40 hover:border-blue-200 px-3 py-2.5 transition flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate">
          {p.name}
          {ap.qtyOverride != null && <span className="ml-2 text-xs font-normal text-[#1D4ED8]">qty overridden</span>}
        </div>
        <div className="text-xs text-slate-400">
          {p.code} - {cur}{unitPrice.toFixed(2)}/{def.unit}
          {ap.labourRate > 0 && <span> - labour {cur}{ap.labourRate.toFixed(2)}/{def.unit}</span>}
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
        Waste
        {p.basis === 'lineal' && (
          <select
            value={ap.wasteMode ?? 'percent'}
            onChange={e => onUpdate({ wasteMode: e.target.value as 'percent' | 'flat' })}
            className="rounded-lg border border-slate-300 px-1.5 py-1.5 text-xs text-slate-600 focus:border-blue-500 focus:outline-none cursor-pointer"
            aria-label={`Waste type for ${p.name}`}
          >
            <option value="percent">%</option>
            <option value="flat">+{def.unit}</option>
          </select>
        )}
        <input
          type="number" min="0" step={ap.wasteMode === 'flat' ? 0.1 : 0.5}
          value={ap.wasteMode === 'flat' ? (ap.wasteFlat || '') : ap.wastePct}
          onChange={e => {
            const v = parseFloat(e.target.value) || 0;
            onUpdate(ap.wasteMode === 'flat' ? { wasteFlat: v } : { wastePct: v });
          }}
          placeholder="0"
          className={`${inputCls} w-14 text-center`}
          aria-label={`Waste value for ${p.name}`}
        />
        {p.basis !== 'lineal' && <span className="text-slate-400">%</span>}
      </label>
      <span className="text-sm font-semibold text-slate-900 whitespace-nowrap flex-shrink-0">
        {purchaseQty.toFixed(1)} {def.unit}
        <span className="ml-2 text-[#1D4ED8]">{cur}{(mat + lab).toFixed(2)}</span>
      </span>
      {advanced && (
        <button onClick={onEdit} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 transition flex-shrink-0 cursor-pointer">
          Edit
        </button>
      )}
      <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition p-1 flex-shrink-0" aria-label={`Remove ${p.name}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/** Inline catalog picker: suggested first, then all, with search. Stays
 *  open after each pick so multiple products can be applied back-to-back;
 *  Done closes it. */
function ProductPicker({ products, def, cur, family, incompatible, activeRoofs, search, setSearch, onPick, appliedIds, onDone }: {
  products: SupplierProduct[];
  def: GroupDef;
  cur: string;
  family: string | null;
  incompatible: SupplierProduct[];
  activeRoofs: string[];
  search: string;
  setSearch: (s: string) => void;
  onPick: (pid: string) => void;
  appliedIds: Set<string>;
  onDone: () => void;
}) {
  const recommended = products.filter(p => isRecommended(p, family));
  const incompatIds = new Set(incompatible.map(p => p.id));
  const others = products.filter(p => !isRecommended(p, family) && !incompatIds.has(p.id));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search name or code..."
        className={`${inputCls} w-full`}
      />
      {recommended.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Recommended{family ? ` - ${family}` : ''}</p>
          {recommended.map(p => <PickerRow key={p.id} p={p} def={def} cur={cur} onPick={onPick} added={appliedIds.has(p.id)} />)}
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Compatible products</p>
          {others.map(p => <PickerRow key={p.id} p={p} def={def} cur={cur} onPick={onPick} added={appliedIds.has(p.id)} />)}
        </>
      )}
      {incompatible.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Other roof types ({activeRoofs.length > 0 ? `not ${activeRoofs.join(' / ')}` : 'all'}) - still selectable
          </p>
          {incompatible.map(p => <PickerRow key={p.id} p={p} def={def} cur={cur} onPick={onPick} added={appliedIds.has(p.id)} />)}
        </div>
      )}
      {products.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-2">No products match "{search}".</p>
      )}
      <div className="pt-1">
        <button
          onClick={onDone}
          className="w-full rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(37,99,235,0.4)] cursor-pointer"
        >
          Done{appliedIds.size > 0 ? ` (${appliedIds.size} added)` : ''}
        </button>
      </div>
    </div>
  );
}

function PickerRow({ p, def, cur, onPick, added }: { p: SupplierProduct; def: GroupDef; cur: string; onPick: (pid: string) => void; added: boolean }) {
  return (
    <button
      onClick={() => onPick(p.id)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${added ? 'border-blue-200 bg-blue-50/40 cursor-default' : 'border-slate-200 bg-white cursor-pointer hover:border-blue-200 hover:bg-blue-50/40'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
        <div className="text-xs text-slate-400">
          {p.code} - {cur}{p.unitPrice.toFixed(2)}/{def.unit}
          {p.defaultWastePct > 0 && <span> - {p.defaultWastePct}% waste</span>}
        </div>
      </div>
      {added ? (
        <span className="flex-shrink-0 flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Added
        </span>
      ) : (
        <span className="flex-shrink-0 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500">Add</span>
      )}
    </button>
  );
}

/** Advanced product editor: labour rate, waste, qty override, price override
 *  (only when the supplier allows price edits on this product). */
function ProductEditorModal({ ap, p, def, cur, onClose, onSave }: {
  ap: AppliedProduct;
  p: SupplierProduct;
  def: GroupDef;
  cur: string;
  onClose: () => void;
  onSave: (patch: Partial<AppliedProduct>) => void;
}) {
  const [wastePct, setWastePct] = useState(String(ap.wastePct));
  const [wasteFlat, setWasteFlat] = useState(ap.wasteFlat ? String(ap.wasteFlat) : '');
  const [wasteMode, setWasteMode] = useState<'percent' | 'flat'>(ap.wasteMode ?? 'percent');
  const [labourRate, setLabourRate] = useState(String(ap.labourRate));
  const [qtyOverride, setQtyOverride] = useState(ap.qtyOverride != null ? String(ap.qtyOverride) : '');
  const [priceOverride, setPriceOverride] = useState(ap.priceOverride != null ? String(ap.priceOverride) : '');

  const qty = qtyOverride.trim() !== '' ? parseFloat(qtyOverride) || 0 : null;
  const price = p.priceEditable && priceOverride.trim() !== '' ? parseFloat(priceOverride) || 0 : null;
  const waste = parseFloat(wastePct) || 0;
  const wasteLen = parseFloat(wasteFlat) || 0;
  const labour = parseFloat(labourRate) || 0;

  const purchaseQty = wasteMode === 'flat'
    ? (qty ?? 0) + wasteLen
    : (qty ?? 0) * (1 + waste / 100);
  const unitPrice = price != null ? price : p.unitPrice;
  const mat = purchaseQty * unitPrice;
  const lab = purchaseQty * labour;

  function save() {
    onSave({
      wastePct: wasteMode === 'flat' ? 0 : waste,
      wasteFlat: wasteMode === 'flat' ? wasteLen : 0,
      wasteMode,
      labourRate: labour,
      qtyOverride: qty,
      priceOverride: price,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{p.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{p.code} - applies per {def.unit}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {p.basis === 'lineal' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600">Waste type</label>
                  <select
                    value={wasteMode}
                    onChange={e => setWasteMode(e.target.value as 'percent' | 'flat')}
                    className={`${inputCls} mt-0.5 w-full cursor-pointer`}
                  >
                    <option value="percent">Percentage</option>
                    <option value="flat">Amount per length ({def.unit})</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    {wasteMode === 'flat' ? `Extra waste (${def.unit})` : 'Waste %'}
                  </label>
                  <input
                    type="number" min="0" step={wasteMode === 'flat' ? 0.1 : 0.5}
                    value={wasteMode === 'flat' ? wasteFlat : wastePct}
                    onChange={e => (wasteMode === 'flat' ? setWasteFlat(e.target.value) : setWastePct(e.target.value))}
                    placeholder="0"
                    className={`${inputCls} mt-0.5 w-full`}
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600">Waste %</label>
                <input type="number" min="0" max="100" step="0.5" value={wastePct} onChange={e => setWastePct(e.target.value)} className={`${inputCls} mt-0.5 w-full`} />
                <p className="mt-0.5 text-[10px] text-slate-400">Area products use percentage waste only.</p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600">Labour rate ({cur}/{def.unit})</label>
              <input type="number" min="0" step="0.1" value={labourRate} onChange={e => setLabourRate(e.target.value)} className={`${inputCls} mt-0.5 w-full`} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Quantity override ({def.unit})</label>
              <input type="number" min="0" step="any" value={qtyOverride} onChange={e => setQtyOverride(e.target.value)} placeholder="measured" className={`${inputCls} mt-0.5 w-full`} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Price override ({cur}/{def.unit})</label>
              <input
                type="number" min="0" step="0.01" value={priceOverride}
                onChange={e => setPriceOverride(e.target.value)}
                placeholder={p.priceEditable ? String(p.unitPrice) : 'locked'}
                disabled={!p.priceEditable}
                className={`${inputCls} mt-0.5 w-full disabled:bg-slate-100 disabled:text-slate-400`}
              />
              {!p.priceEditable && <p className="mt-0.5 text-[10px] text-slate-400">Supplier has locked this price</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">Purchase qty: {purchaseQty.toFixed(1)} {def.unit}</span>
            <span className="text-sm font-semibold text-slate-900">
              {cur}{mat.toFixed(2)}{lab > 0 && <span className="text-xs font-normal text-slate-500"> + {cur}{lab.toFixed(2)} labour</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 transition">
            Cancel
          </button>
          <button onClick={save} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
