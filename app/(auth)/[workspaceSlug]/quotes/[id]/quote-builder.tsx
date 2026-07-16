'use client';
import { useState, useRef, useEffect, type ReactNode, Fragment } from 'react';
import Link from 'next/link';
import { addQuoteRoofArea, updateQuoteRoofArea, removeQuoteRoofArea, toggleAreaLock, addRoofAreaEntry, removeRoofAreaEntry, addQuoteComponent, removeQuoteComponent, addComponentEntry, removeComponentEntry, updateComponentSettings, useRoofAreaTotal, updateQuoteMargins, combineLinealEntries, splitLinealEntries } from '../actions';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import { entryLabel, addMoreLabel, measurementTypeLabel } from '@/app/lib/types';
// Use the polymorphic helpers for any user-input -> metric conversion. They
// dispatch correctly across all three systems (metric / imperial_ft /
// imperial_rs) so we don't have to branch on the system manually anywhere
// the user types a number into an Imperial quote.
import {
  
  linearInputToMetric,
  areaInputToMetric,
  volumeInputToMetric,
} from '@/app/lib/measurements/conversions';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { formatArea, formatLinear, formatVolume, getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import type { QuoteRow, QuoteRoofAreaRow, QuoteRoofAreaEntryRow, QuoteComponentRow, QuoteComponentEntryRow, ComponentLibraryRow, InputMode } from '@/app/lib/types';
// MeasurementSystemToggle removed: a quote's measurement system is locked at
// creation time and cannot be changed afterwards (see
// QuoteDetailsForm + convertQuoteMeasurementSystem).
import { QuoteNameEditor } from './QuoteNameEditor';
import { ConfirmQuoteButton } from './ConfirmQuoteButton';
import { CurrencySelector } from './CurrencySelector';
import { FilesManager } from './FilesManager';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { CreateSmartComponentModal } from '@/app/components/CreateSmartComponentModal';
import type { MeasurementSystem } from '@/app/lib/types';
// F-15: Extracted sub-components
import { RoofAreaCard } from './quote-builder/RoofAreaCard';
import { ExpandableComponent } from './quote-builder/ExpandableComponent';
import { AddFromLibrary } from './quote-builder/AddFromLibrary';
import { formatQuantity, formatPricedQuantity } from './quote-builder/helpers';

type Phase = 'areas' | 'components' | 'extras' | 'review';

interface SupportingFile {
  storagePath: string;
  id: string;
  fileName: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
}

interface Props {
  quote: QuoteRow;
  initialRoofAreas: QuoteRoofAreaRow[];
  initialRoofAreaEntries: Record<string, QuoteRoofAreaEntryRow[]>;
  initialComponents: QuoteComponentRow[];
  initialEntries: Record<string, QuoteComponentEntryRow[]>;
  libraryComponents: ComponentLibraryRow[];
  workspaceSlug: string;
  companyDefaultCurrency: string;
  planUrl: string | null;
  planName: string | null;
  supportingFiles: SupportingFile[];
  hasExistingTakeoff?: boolean;
  linesImageUrl?: string | null;
  planStoragePath?: string | null;
  allPlans?: { pageId: string; pageOrder: number; pageName: string; thumbnailUrl: string | null; areas: string[] }[];
  takeoffData?: any[];
  externalPhase?: Phase; // NEW: For URL-based navigation (v2)
  onPhaseChange?: (phase: Phase) => void; // NEW: Callback when phase changes
  /** When true the company is over storage - block file uploads. */
  isOverStorage?: boolean;
  /** Company defaults for mid-quote Smart Component™ creation. */
  companyMeasurementSystem?: MeasurementSystem;
  companyDefaultTrade?: string;
  collections?: { id: string; name: string; is_bootstrap: boolean }[];
}

export function QuoteBuilder({
  quote: initialQuote,
  initialRoofAreas,
  initialRoofAreaEntries,
  initialComponents,
  initialEntries,
  libraryComponents,
  workspaceSlug,
  companyDefaultCurrency,
  planUrl,
  planName,
  supportingFiles,
  hasExistingTakeoff = false,
  linesImageUrl = null,
  planStoragePath = null,
  allPlans = [],
  takeoffData: _takeoffData = [],
  externalPhase,
  onPhaseChange,
  isOverStorage,
  companyMeasurementSystem = 'metric',
  companyDefaultTrade = 'roofing',
  collections = [],
}: Props) {
  console.log('[QuoteBuilder] Received components:', initialComponents.length, initialComponents.map(c => ({ name: c.name, type: c.component_type })));
  const [internalPhase, setInternalPhase] = useState<Phase>('areas');
  
  // Use external phase if provided, otherwise use internal
  const phase = externalPhase ?? internalPhase;
  const setPhase = (newPhase: Phase) => {
    if (onPhaseChange) {
      onPhaseChange(newPhase);
    } else {
      setInternalPhase(newPhase);
    }
  };
  const [quote, setQuote] = useState(initialQuote);
  // Phase 8: trade-aware labels + convenience flag.
  const tradeLabels = getTradeLabels((quote as { trade?: string }).trade);
  // (2026-07-12) quoteIsGeneric removed: no-area component rendering now
  // applies to ALL trades, since roofing quotes can skip area creation too.
  // Update quote state when props change (e.g., after currency change)
  useEffect(() => {
    setQuote(initialQuote);
  }, [initialQuote.currency, initialQuote.measurement_system]);
  
  // Margin controls state
  const [materialMarginEnabled, setMaterialMarginEnabled] = useState(quote.material_margin_enabled ?? true);
  const [laborMarginEnabled, setLaborMarginEnabled] = useState(quote.labor_margin_enabled ?? true);
  const [materialMarginPercent, setMaterialMarginPercent] = useState<string>(
    (quote.material_margin_percent ?? 0).toString()
  );
  const [laborMarginPercent, setLaborMarginPercent] = useState<string>(
    (quote.labor_margin_percent ?? 0).toString()
  );
  const [marginSaving, setMarginSaving] = useState(false);
  
  const [roofAreas, setRoofAreas] = useState(initialRoofAreas);
  const [roofAreaEntries, setRoofAreaEntries] = useState(initialRoofAreaEntries);
  const [components, setComponents] = useState(initialComponents);
  const [entries, setEntries] = useState(initialEntries);
  // localLibrary: lifted from prop so newly-created mid-quote components are
  // immediately available for future adds in the same session.
  const [localLibrary, setLocalLibrary] = useState<ComponentLibraryRow[]>(libraryComponents);
  // Mid-quote Smart Component™ creation modal state.
  const [showCreateComponentModal, setShowCreateComponentModal] = useState(false);
  const [createCompForAreaId, setCreateCompForAreaId] = useState<string | null>(null);
  const [createCompType, setCreateCompType] = useState<'main' | 'extra'>('main');
  const [newAreaLabel, setNewAreaLabel] = useState('');
  const [areaPendingDelete, setAreaPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [areaDeleting, setAreaDeleting] = useState(false);
  // Empty-quote guard: when the user clicks Confirm without any roof areas
  // or main components, we show an explanation modal instead of confirming
  // a hollow quote. Clicking OK bounces them back to the Roof Areas phase.
  const [showEmptyQuoteGuard, setShowEmptyQuoteGuard] = useState<null | 'no-areas' | 'no-main-components'>(null);

  const mainComps = components.filter(c => c.component_type === 'main');
  const extraComps = components.filter(c => c.component_type === 'extra');
  console.log('[QuoteBuilder] Filtered - mainComps:', mainComps.length, 'extraComps:', extraComps.length);
  const totalRoofSqm = roofAreas.reduce((sum, a) => sum + (a.computed_sqm ?? 0), 0);
  
  // Get effective currency for display
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

  const engineComps = components.map(c => ({
    id: c.id,
    name: c.name,
    componentType: c.component_type as 'main' | 'extra',
    measurementType: c.measurement_type as 'area' | 'lineal' | 'quantity' | 'fixed',
    inputMode: c.input_mode as 'final' | 'calculated',
    finalValue: c.final_value ?? undefined,
    calcRawValue: c.calc_raw_value ?? undefined,
    calcPitchDegrees: c.calc_pitch_degrees ?? undefined,
    calcPitchFactor: c.calc_pitch_factor ?? undefined,
    wasteType: c.waste_type as 'percent' | 'fixed' | 'none',
    wastePercent: c.waste_percent,
    wasteFixed: c.waste_fixed,
    finalQuantity: c.final_quantity ?? undefined,
    materialRate: c.material_rate,
    labourRate: c.labour_rate,
    materialCost: c.material_cost,
    labourCost: c.labour_cost,
    isRateOverridden: c.is_rate_overridden,
    isQuantityOverridden: c.is_quantity_overridden,
    isWasteOverridden: c.is_waste_overridden,
    isPitchOverridden: c.is_pitch_overridden,
    isCustomerVisible: c.is_customer_visible,
    pricingUnit: c.pricing_unit ?? undefined,
  }));

  const totals = computeQuoteTotals(engineComps, {
    materialMarginPct: (quote.material_margin_enabled ?? true) 
      ? (quote.material_margin_percent ?? 0) 
      : 0,
    labourMarginPct: (quote.labor_margin_enabled ?? true) 
      ? (quote.labor_margin_percent ?? 0) 
      : 0,
    taxRate: quote.tax_rate
  });

  const allAreasLocked = roofAreas.every(a => a.is_locked);

  async function handleAddArea() {
    if (!newAreaLabel.trim()) return;
    const created = await addQuoteRoofArea(quote.id, newAreaLabel.trim());
    setRoofAreas(prev => [...prev, created]);
    setRoofAreaEntries(prev => ({ ...prev, [created.id]: [] }));
    setNewAreaLabel('');
  }

  async function handleUpdateArea(id: string, updates: Parameters<typeof updateQuoteRoofArea>[1]) {
    const updated = await updateQuoteRoofArea(id, updates);
    setRoofAreas(prev => prev.map(a => a.id === id ? updated : a));
    if (updates.calc_pitch_degrees && updates.calc_pitch_degrees > 0 && !quote.global_pitch_degrees) {
      setQuote(prev => ({ ...prev, global_pitch_degrees: updates.calc_pitch_degrees! }));
    }
  }

  async function handleToggleLock(id: string, locked: boolean) {
    await toggleAreaLock(id, locked);
    setRoofAreas(prev => prev.map(a => a.id === id ? { ...a, is_locked: locked } : a));
  }

  async function handleAddRoofAreaEntry(areaId: string, widthInput: number, lengthInput: number) {
    const area = roofAreas.find(a => a.id === areaId);
    if (!area) return;
    // Convert imperial inputs to metric for storage. linearInputToMetric()
    // is a no-op for metric quotes and converts feet -> meters for both
    // imperial_ft and imperial_rs.
    const widthM = linearInputToMetric(widthInput, quote.measurement_system);
    const lengthM = linearInputToMetric(lengthInput, quote.measurement_system);
    const entry = await addRoofAreaEntry(areaId, widthM, lengthM, area.calc_pitch_degrees ?? 0);
    setRoofAreaEntries(prev => ({ ...prev, [areaId]: [...(prev[areaId] ?? []), entry] }));
    const areaEnts = [...(roofAreaEntries[areaId] ?? []), entry];
    const totalSqm = areaEnts.reduce((s, e) => s + Number(e.sqm), 0);
    setRoofAreas(prev => prev.map(a => a.id === areaId ? { ...a, computed_sqm: totalSqm } : a));
  }

  async function handleRemoveRoofAreaEntry(entryId: string, areaId: string) {
    await removeRoofAreaEntry(entryId, areaId);
    const updated = (roofAreaEntries[areaId] ?? []).filter(e => e.id !== entryId);
    setRoofAreaEntries(prev => ({ ...prev, [areaId]: updated }));
    const totalSqm = updated.reduce((s, e) => s + Number(e.sqm), 0);
    setRoofAreas(prev => prev.map(a => a.id === areaId ? { ...a, computed_sqm: totalSqm } : a));
  }

  function handleRemoveArea(id: string) {
    const area = roofAreas.find(a => a.id === id);
    setAreaPendingDelete({ id, label: area?.label || `this ${tradeLabels.areaSingularLabel.toLowerCase()}` });
  }

  async function confirmRemoveArea() {
    if (!areaPendingDelete) return;
    setAreaDeleting(true);
    try {
      await removeQuoteRoofArea(areaPendingDelete.id);
      setRoofAreas(prev => prev.filter(a => a.id !== areaPendingDelete.id));
      setComponents(prev => prev.filter(c => c.quote_roof_area_id !== areaPendingDelete.id));
      setAreaPendingDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to delete ${tradeLabels.areaSingularLabel.toLowerCase()}`);
    } finally {
      setAreaDeleting(false);
    }
  }

  async function handleAddFromLibrary(libId: string, areaId: string | null, type: 'main' | 'extra') {
    const lib = localLibrary.find(c => c.id === libId);
    if (!lib) return;
    const created = await addQuoteComponent(quote.id, {
      quote_roof_area_id: areaId ?? undefined,
      component_library_id: libId,
      name: lib.name,
      component_type: type,
      measurement_type: lib.measurement_type,
      material_rate: lib.default_material_rate,
      labour_rate: lib.default_labour_rate,
      waste_type: lib.default_waste_type,
      waste_percent: lib.default_waste_percent,
      waste_fixed: lib.default_waste_fixed,
      pitch_type: lib.default_pitch_type,
    });
    setComponents(prev => [...prev, created]);
    setEntries(prev => ({ ...prev, [created.id]: [] }));
  }

  /**
   * Called when a new Smart Component™ is created mid-quote via the modal.
   * Adds to localLibrary (so it’s available for future adds this session)
   * then immediately creates the quote_component row.
   */
  async function handleComponentCreated(comp: ComponentLibraryRow) {
    setLocalLibrary(prev => [...prev, comp]);
    // Directly create the quote component from the returned library row
    // (avoids relying on the state update being synchronous).
    const created = await addQuoteComponent(quote.id, {
      quote_roof_area_id: createCompForAreaId ?? undefined,
      component_library_id: comp.id,
      name: comp.name,
      component_type: createCompType,
      measurement_type: comp.measurement_type,
      material_rate: comp.default_material_rate,
      labour_rate: comp.default_labour_rate,
      waste_type: comp.default_waste_type,
      waste_percent: comp.default_waste_percent,
      waste_fixed: comp.default_waste_fixed,
      pitch_type: comp.default_pitch_type,
    });
    setComponents(prev => [...prev, created]);
    setEntries(prev => ({ ...prev, [created.id]: [] }));
    setShowCreateComponentModal(false);
  }

  async function handleRemoveComponent(id: string) {
    await removeQuoteComponent(id);
    setComponents(prev => prev.filter(c => c.id !== id));
    setEntries(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  async function handleAddEntry(compId: string, rawInputValue: number, options?: { bypassHeightMultiplier?: boolean; bypassDepthMultiplier?: boolean; convertAs?: 'area' | 'linear' | 'volume' | 'none'; entryHeightM?: number | null; entryDepthM?: number | null }) {
    const comp = components.find(c => c.id === compId);
    // Convert imperial inputs to metric for storage. The helpers handle the
    // 3 systems correctly:
    //   - imperial_ft: ft -> m (linear), ft² -> m² (area), ft³ -> m³ (volume)
    //   - imperial_rs: ft -> m (linear), RS  -> m² (area)
    //   - metric:     pass through
    //   - quantity / fixed: pass through (no unit attached)
    let rawValue = rawInputValue;
    const mt = comp?.measurement_type as string;
    // 'none' = caller already converted to metric; skip auto-conversion.
    const convertAs = options?.convertAs === undefined
      ? (mt === 'area' || mt === 'irregular_area' ? 'area'
        : mt === 'length_x_height' || mt === 'multi_lineal_lxh' ? 'linear'
        : mt === 'volume' || mt === 'volume_3d' ? 'volume'
        : mt === 'lineal' || mt === 'linear' || mt === 'multi_lineal' || mt === 'curved_line' ? 'linear'
        : null)
      : (options?.convertAs === 'none' ? null : options?.convertAs);
    if (convertAs === 'area') {
      rawValue = areaInputToMetric(rawInputValue, quote.measurement_system);
    } else if (convertAs === 'volume') {
      rawValue = volumeInputToMetric(rawInputValue, quote.measurement_system);
    } else if (convertAs === 'linear') {
      rawValue = linearInputToMetric(rawInputValue, quote.measurement_system);
    }
    const areaPitch = comp?.quote_roof_area_id
      ? roofAreas.find(a => a.id === comp.quote_roof_area_id)?.calc_pitch_degrees ?? null
      : null;
    const entry = await addComponentEntry(compId, rawValue, areaPitch, options);
    const totals = (entry as { componentTotals?: { final_quantity: number; priced_quantity: number | null; material_cost: number; labour_cost: number } }).componentTotals;
    setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
    setComponents(prev => prev.map(c => c.id === compId ? {
      ...c,
      final_quantity: totals?.final_quantity ?? c.final_quantity,
      priced_quantity: totals ? totals.priced_quantity : c.priced_quantity,
      material_cost: totals?.material_cost ?? c.material_cost,
      labour_cost: totals?.labour_cost ?? c.labour_cost,
    } : c));
  }

  async function handleUseRoofArea(compId: string, roofAreaSqm: number) {
    const _comp = components.find(c => c.id === compId);
    // Roof area total is already pitched - don't apply pitch again
    // `useRoofAreaTotal` is a server action, not a React hook - React's
    // rules-of-hooks heuristic flags it on the `use*` name. Renaming the
    // action is a larger change; suppress here is the lower-risk path.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const entry = await useRoofAreaTotal(compId, roofAreaSqm, null);
    const totals = (entry as { componentTotals?: { final_quantity: number; priced_quantity: number | null; material_cost: number; labour_cost: number } }).componentTotals;
    setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
    setComponents(prev => prev.map(c => c.id === compId ? {
      ...c,
      final_quantity: totals?.final_quantity ?? c.final_quantity,
      priced_quantity: totals ? totals.priced_quantity : c.priced_quantity,
      material_cost: totals?.material_cost ?? c.material_cost,
      labour_cost: totals?.labour_cost ?? c.labour_cost,
    } : c));
  }

  async function handleRemoveEntry(entryId: string, compId: string) {
    const totals = await removeComponentEntry(entryId, compId);
    const updated = (entries[compId] ?? []).filter(e => e.id !== entryId);
    setEntries(prev => ({ ...prev, [compId]: updated }));
    setComponents(prev => prev.map(c => c.id === compId ? {
      ...c,
      final_quantity: totals?.final_quantity ?? c.final_quantity,
      priced_quantity: totals ? totals.priced_quantity : c.priced_quantity,
      material_cost: totals?.material_cost ?? c.material_cost,
      labour_cost: totals?.labour_cost ?? c.labour_cost,
    } : c));
  }

  /** Phase 6.5: collapse all entries on a lineal-shaped component into
   *  one combined entry. Updates local state in-place using the new entry
   *  + recalculated component totals returned by the server action - no
   *  page reload, which previously reset the manual-mode tab state back
   *  to Roof Areas (the internal useState default in QuoteBuilder). */
  async function handleCombineEntries(compId: string) {
    const result = await combineLinealEntries(compId);
    if (!result.ok || !result.combinedEntry) {
      alert(result.error ?? 'Could not combine entries.');
      return;
    }
    // Replace this component's entries array with the single combined row.
    // QuoteComponentEntryRow is stale on the Phase 2 is_combined / combined_from
    // columns; the read sites cast at the boundary so the looser shape is fine.
    setEntries((prev) => ({
      ...prev,
      [compId]: [result.combinedEntry as unknown as QuoteComponentEntryRow],
    }));
    if (result.componentTotals) {
      setComponents((prev) =>
        prev.map((c) =>
          c.id === compId
            ? {
                ...c,
                final_quantity: result.componentTotals!.final_quantity,
                priced_quantity: result.componentTotals!.priced_quantity,
                material_cost: result.componentTotals!.material_cost,
                labour_cost: result.componentTotals!.labour_cost,
              }
            : c,
        ),
      );
    }
  }

  /** Phase 6.5: split a combined entry back into its source rows. Same
   *  in-place state update pattern as combine. */
  async function handleSplitEntries(compId: string) {
    const result = await splitLinealEntries(compId);
    if (!result.ok || !result.restoredEntries) {
      alert(result.error ?? 'Could not split entries.');
      return;
    }
    setEntries((prev) => ({
      ...prev,
      [compId]: result.restoredEntries as unknown as QuoteComponentEntryRow[],
    }));
    if (result.componentTotals) {
      setComponents((prev) =>
        prev.map((c) =>
          c.id === compId
            ? {
                ...c,
                final_quantity: result.componentTotals!.final_quantity,
                priced_quantity: result.componentTotals!.priced_quantity,
                material_cost: result.componentTotals!.material_cost,
                labour_cost: result.componentTotals!.labour_cost,
              }
            : c,
        ),
      );
    }
  }

  async function handleUpdateCompSettings(
    compId: string,
    updates: {
      input_mode?: InputMode;
      quote_roof_area_id?: string | null;
      use_custom_pitch?: boolean;
      custom_pitch_degrees?: number | null;
    }
  ) {
    await updateComponentSettings(compId, updates);
    setComponents(prev => prev.map(c => c.id === compId ? { ...c, ...updates } : c));
  }


  // Helper to format component quantity with correct units
  function formatQuantity(qty: number, measurementType: string): string {
    if (measurementType === 'area') {
      return formatArea(qty, quote.measurement_system);
    }
    if (measurementType === 'lineal') {
      return formatLinear(qty, quote.measurement_system);
    }
    return `${qty.toFixed(1)} ${getUnitLabel(measurementType as any, quote.measurement_system)}`;
  }

  // Fixed Quantity strategies: show rounded purchasable units (priced_quantity)
  // with actual in italic brackets e.g. "5 (4.84)". per_unit = NULL priced_quantity
  // so falls back to formatQuantity, rendering exactly as before.
  function formatPricedQuantity(c: { final_quantity: number | null; priced_quantity?: number | string | null; pack_size_snapshot?: number | string | null; measurement_type: string }): ReactNode {
    const actual = Number(c.final_quantity ?? 0);
    // Supabase returns numeric columns as strings at runtime — use Number().
    const priced = c.priced_quantity != null ? Number(c.priced_quantity) : null;
    const packSnap = c.pack_size_snapshot != null ? Number(c.pack_size_snapshot) : null;
    if (priced != null && !isNaN(priced)) {
      const fractional = packSnap && !isNaN(packSnap) && packSnap > 0 ? actual / packSnap : actual;
      return (
        <>
          {priced.toFixed(0)} <span className="italic text-slate-400">({fractional.toFixed(2)})</span>
        </>
      );
    }
    return formatQuantity(actual, c.measurement_type);
  }

  const phases: { key: Phase; label: string }[] = [
    { key: 'areas', label: `1. ${tradeLabels.builderStepLabel}` },
    { key: 'components', label: '2. Components' },
    { key: 'extras', label: '3. Extras' },
    { key: 'review', label: '4. Review' },
  ];

  // Save margin settings
  const handleSaveMargins = async () => {
    const matPercent = parseFloat(materialMarginPercent);
    const labPercent = parseFloat(laborMarginPercent);

    if (isNaN(matPercent) || matPercent < 0 || matPercent > 100) {
      alert('Item Cost margin must be between 0 and 100%');
      return;
    }

    if (isNaN(labPercent) || labPercent < 0 || labPercent > 100) {
      alert('Labor margin must be between 0 and 100%');
      return;
    }

    setMarginSaving(true);
    try {
      await updateQuoteMargins(quote.id, {
        materialMarginPercent: materialMarginEnabled ? matPercent : null,
        laborMarginPercent: laborMarginEnabled ? labPercent : null,
        materialMarginEnabled,
        laborMarginEnabled,
      });

      // Update local quote state
      setQuote({
        ...quote,
        material_margin_percent: matPercent,
        labor_margin_percent: labPercent,
        material_margin_enabled: materialMarginEnabled,
        labor_margin_enabled: laborMarginEnabled,
      });
    } catch (err) {
      console.error('Failed to save margins:', err);
      alert('Failed to save margins. Please try again.');
    } finally {
      setMarginSaving(false);
    }
  };

  return (
    <>
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Link href={`/${workspaceSlug}/quotes`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Quotes
          </Link>
          <div className="mt-1">
            <QuoteNameEditor 
              quoteId={quote.id}
              customerName={quote.customer_name}
              jobName={quote.job_name}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {quote.status === 'draft' && (
            <>
              <CurrencySelector 
                quoteId={quote.id}
                currentCurrency={quote.currency}
                companyDefaultCurrency={companyDefaultCurrency}
                workspaceSlug={workspaceSlug}
              />
            </>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            quote.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'
          }`}>
            {quote.status}
          </span>
        </div>
      </div>

      {/* Edit Digital Take-off — always visible above Plans & Files (2026-07-06) */}
      {((hasExistingTakeoff || planUrl) && (
        <div className="mb-3">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}/takeoff`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-medium rounded-full text-sm hover:bg-slate-800 transition-colors hover:shadow-[0_0_12px_rgba(249,115,22,0.45)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {hasExistingTakeoff ? 'Edit Digital Take-off' : 'Use Digital Take-off'}
          </Link>
        </div>
      ))}

      {/* Files & Documents (Roof Plan + Supporting) */}
      <FilesManager 
        quoteId={quote.id}
        companyId={quote.company_id}
        workspaceSlug={workspaceSlug}
        planUrl={planUrl}
        planName={planName}
        supportingFiles={supportingFiles}
        hasExistingTakeoff={hasExistingTakeoff}
        linesImageUrl={linesImageUrl}
        planStoragePath={planStoragePath}
        allPlans={allPlans}
        isOverStorage={isOverStorage}
      />

      <nav className="flex gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto scrollbar-hide">
        {phases.map(p => (
          <button
            key={p.key}
            onClick={() => setPhase(p.key)}
            className={`flex-1 md:flex-none py-2 px-3 text-sm font-medium rounded-full transition whitespace-nowrap ${
              phase === p.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap gap-x-4 gap-y-1 p-3 bg-slate-50 rounded-lg text-sm">
        <span>{tradeLabels.areaSingularLabel}: <strong>{formatArea(totalRoofSqm, quote.measurement_system)}</strong></span>
        <span>Item Cost: <strong>{formatCurrency(totals.totalMaterials, effectiveCurrency)}</strong></span>
        <span>Labour: <strong>{formatCurrency(totals.totalLabour, effectiveCurrency)}</strong></span>
        <span className="w-full md:w-auto md:ml-auto font-semibold">Total: {formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
      </div>

      {phase === 'areas' && (
        <div className="space-y-4">
          {roofAreas.map(area => (
            <RoofAreaCard
              key={area.id}
              area={area}
              entries={roofAreaEntries[area.id] ?? []}
              quote={quote}
              onUpdate={handleUpdateArea}
              onToggleLock={handleToggleLock}
              onAddEntry={handleAddRoofAreaEntry}
              onRemoveEntry={handleRemoveRoofAreaEntry}
              onRemove={handleRemoveArea}
            />
          ))}
          {/* Add-area input. (Previously hidden mid-Copilot-guide when an area
              was unconfirmed; Copilot removed, so it always shows now.) */}
          <div className="flex gap-2" data-copilot="quote-add-area-row">
            <input
              value={newAreaLabel}
              onChange={e => setNewAreaLabel(e.target.value)}
              placeholder={tradeLabels.areaIsOptional ? tradeLabels.areaNamePlaceholder : 'e.g. Main Roof, Garage'}
              data-copilot="quote-area-name"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
              onKeyDown={e => e.key === 'Enter' && handleAddArea()}
            />
            <button
              onClick={handleAddArea}
              disabled={!newAreaLabel.trim()}
              data-copilot="quote-add-area"
              className="px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {tradeLabels.addAreaCta}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setPhase('components')}
              disabled={!allAreasLocked}
              data-copilot="quote-next-components"
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              {allAreasLocked ? 'Next: Components →' : 'Confirm all areas to continue'}
            </button>
          </div>
        </div>
      )}

      {phase === 'components' && (
        <div className="space-y-4" data-copilot="quote-components-phase">
          {/* Phase 8: quotes with no areas - show a flat component list.
              All components live at the quote level (quote_roof_area_id = NULL)
              rather than under an area. We show ALL components here regardless
              of type. This applies to both generic trades and roofing quotes
              where the user skipped area creation and went straight to components. */}
          {roofAreas.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Components</h3>
              {components.filter(c => !c.quote_roof_area_id).map((comp, idx) => (
                <ExpandableComponent
                  key={comp.id}
                  comp={comp}
                  entries={entries[comp.id] ?? []}
                  roofAreas={roofAreas}
                  quote={quote}
                  currency={effectiveCurrency}
                  onAddEntry={handleAddEntry}
                  onRemoveEntry={handleRemoveEntry}
                  onRemove={handleRemoveComponent}
                  onUpdateSettings={handleUpdateCompSettings}
                  onCombineEntries={handleCombineEntries}
                  onSplitEntries={handleSplitEntries}
                  copilotId={idx === 0 ? 'quote-first-component' : undefined}
                />
              ))}
              <AddFromLibrary
                library={localLibrary}
                onAdd={libId => handleAddFromLibrary(libId, null, 'main')}
                onCreateNew={() => { setCreateCompForAreaId(null); setCreateCompType('main'); setShowCreateComponentModal(true); }}
                copilotId="quote-add-from-library"
                measurementSystem={quote.measurement_system}
              />
            </div>
          )}
          {roofAreas.map((area, areaIdx) => {
            const areaComps = mainComps.filter(c => c.quote_roof_area_id === area.id);
            return (
              <div key={area.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="font-semibold text-slate-900">
                  {area.label}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    ({formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
                    {area.calc_pitch_degrees ? ` @ ${area.calc_pitch_degrees}°` : ''})
                  </span>
                </h3>
                {areaComps.map((comp, compIdx) => (
                  <ExpandableComponent
                    key={comp.id}
                    comp={comp}
                    entries={entries[comp.id] ?? []}
                    roofAreas={roofAreas}
                    roofArea={area}
                    quote={quote}
                    currency={effectiveCurrency}
                    onAddEntry={handleAddEntry}
                    onUseRoofArea={handleUseRoofArea}
                    onRemoveEntry={handleRemoveEntry}
                    onRemove={handleRemoveComponent}
                    onUpdateSettings={handleUpdateCompSettings}
                    onCombineEntries={handleCombineEntries}
                    onSplitEntries={handleSplitEntries}
                    copilotId={areaIdx === 0 && compIdx === 0 ? 'quote-first-component' : undefined}
                  />
                ))}
                <AddFromLibrary
                  library={localLibrary.filter(c => c.component_type === 'main')}
                  onAdd={libId => handleAddFromLibrary(libId, area.id, 'main')}
                  onCreateNew={() => { setCreateCompForAreaId(area.id); setCreateCompType('main'); setShowCreateComponentModal(true); }}
                  copilotId={areaIdx === 0 ? 'quote-add-from-library' : undefined}
                  measurementSystem={quote.measurement_system}
                />
              </div>
            );
          })}
          <div className="flex justify-between">
            <button
              onClick={() => setPhase('areas')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              ← {tradeLabels.areaPluralLabel}
            </button>
            <button
              onClick={() => setPhase('extras')}
              data-copilot="quote-next-extras"
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Next: Extras →
            </button>
          </div>
        </div>
      )}

      {phase === 'extras' && (
        <div className="space-y-4" data-copilot="quote-extras-phase">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Extras</h3>
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>You can only add pre-saved component extras here. To add fully custom &ldquo;Extras&rdquo; lines, use the customer quote editor tool after finishing this quote builder phase.</span>
            </div>
            {extraComps.map(comp => (
              <ExpandableComponent
                key={comp.id}
                comp={comp}
                entries={entries[comp.id] ?? []}
                roofAreas={roofAreas}
                quote={quote}
                currency={effectiveCurrency}
                onAddEntry={handleAddEntry}
                onRemoveEntry={handleRemoveEntry}
                onRemove={handleRemoveComponent}
                onUpdateSettings={handleUpdateCompSettings}
                onCombineEntries={handleCombineEntries}
                onSplitEntries={handleSplitEntries}
              />
            ))}
            <AddFromLibrary
              library={localLibrary.filter(c => c.component_type === 'extra')}
              onAdd={libId => handleAddFromLibrary(libId, null, 'extra')}
              onCreateNew={() => { setCreateCompForAreaId(null); setCreateCompType('extra'); setShowCreateComponentModal(true); }}
              measurementSystem={quote.measurement_system}
            />
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setPhase('components')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              ← Smart Components™
            </button>
            <button
              onClick={() => setPhase('review')}
              data-copilot="quote-next-review"
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-6" data-copilot="quote-review-phase">
          {roofAreas.map(area => {
            const areaComps = components.filter(c => c.quote_roof_area_id === area.id);
            return (
              <div key={area.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900 mb-2">
                  {area.label} - {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
                </h3>
                {areaComps.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b">
                        <th className="py-1">Component</th>
                        <th className="py-1 text-right">Entries</th>
                        <th className="py-1 text-right">Total Qty</th>
                        <th className="py-1 text-right">Item Cost</th>
                        <th className="py-1 text-right">Labour</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaComps.map(c => (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="py-1.5">
                            {c.name}
                            {(c.is_rate_overridden || c.is_waste_overridden) && (
                              <span className="ml-1 text-xs text-amber-600">●</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right">{(entries[c.id] ?? []).length}</td>
                          <td className="py-1.5 text-right">
                            {formatPricedQuantity(c)}
                          </td>
                          <td className="py-1.5 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                          <td className="py-1.5 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                          <td className="py-1.5 text-right font-medium">
                            {formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-slate-400">No components</p>
                )}
              </div>
            );
          })}

          {/* H-04 (Gerald round-5): no-area main components were invisible
              in Review because they aren't under a roof area or in extraComps
              (which filters by component_type='extra'). Applies to ALL trades
              (2026-07-12): roofing quotes can also skip area creation. */}
          {roofAreas.length === 0 && (() => {
            const noAreaComps = components.filter(c => !c.quote_roof_area_id);
            if (noAreaComps.length === 0) return null;
            return (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900 mb-2">Quote items</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-1">Component</th>
                      <th className="py-1 text-right">Entries</th>
                      <th className="py-1 text-right">Total Qty</th>
                      <th className="py-1 text-right">Item Cost</th>
                      <th className="py-1 text-right">Labour</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noAreaComps.map(c => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="py-1.5">{c.name}</td>
                        <td className="py-1.5 text-right">{(entries[c.id] ?? []).length}</td>
                        <td className="py-1.5 text-right">{formatPricedQuantity(c)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                        <td className="py-1.5 text-right font-medium">{formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {extraComps.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-slate-900 mb-2">Extras</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-1">Extra</th>
                    <th className="py-1 text-right">Entries</th>
                    <th className="py-1 text-right">Total Qty</th>
                    <th className="py-1 text-right">Item Cost</th>
                    <th className="py-1 text-right">Labour</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {extraComps.map(c => (
                    <tr key={c.id} className="border-b border-amber-100">
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 text-right">{(entries[c.id] ?? []).length}</td>
                      <td className="py-1.5 text-right">{formatPricedQuantity(c)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(c.material_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(c.labour_cost ?? 0, effectiveCurrency)}</td>
                      <td className="py-1.5 text-right font-medium">
                        {formatCurrency((c.material_cost ?? 0) + (c.labour_cost ?? 0), effectiveCurrency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Profit Margin Controls */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 space-y-4" data-copilot="quote-margins">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">💸 Profit Margins</h3>
              <p className="text-sm text-gray-600 mt-1">Adjust your profit margins - saved automatically when you confirm.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Material Margin */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={materialMarginEnabled}
                    onChange={(e) => setMaterialMarginEnabled(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-semibold text-gray-900">Item Cost Margin</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={materialMarginPercent}
                    onChange={(e) => setMaterialMarginPercent(e.target.value)}
                    disabled={!materialMarginEnabled}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                </div>
                {materialMarginEnabled && (
                  <p className="text-xs text-gray-600 mt-2">
                    +{formatCurrency(totals.totalMaterials * (parseFloat(materialMarginPercent) || 0) / 100, effectiveCurrency)} profit
                  </p>
                )}
              </div>

              {/* Labor Margin */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={laborMarginEnabled}
                    onChange={(e) => setLaborMarginEnabled(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-semibold text-gray-900">Labour Margin</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={laborMarginPercent}
                    onChange={(e) => setLaborMarginPercent(e.target.value)}
                    disabled={!laborMarginEnabled}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                </div>
                {laborMarginEnabled && (
                  <p className="text-xs text-gray-600 mt-2">
                    +{formatCurrency(totals.totalLabour * (parseFloat(laborMarginPercent) || 0) / 100, effectiveCurrency)} profit
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>💡 Note:</strong> Margins are hidden from customers. They only see the final total price.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Item Cost</span>
              <span>{formatCurrency(totals.totalMaterials, effectiveCurrency)}</span>
            </div>
            {materialMarginEnabled && parseFloat(materialMarginPercent) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span className="ml-4 text-xs">+ Item Cost Margin ({materialMarginPercent}%)</span>
                <span>+{formatCurrency(totals.totalMaterials * parseFloat(materialMarginPercent) / 100, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Total Labour</span>
              <span>{formatCurrency(totals.totalLabour, effectiveCurrency)}</span>
            </div>
            {laborMarginEnabled && parseFloat(laborMarginPercent) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span className="ml-4 text-xs">+ Labour Margin ({laborMarginPercent}%)</span>
                <span>+{formatCurrency(totals.totalLabour * parseFloat(laborMarginPercent) / 100, effectiveCurrency)}</span>
              </div>
            )}
            {((materialMarginEnabled && parseFloat(materialMarginPercent) > 0) || (laborMarginEnabled && parseFloat(laborMarginPercent) > 0)) && (
              <div className="flex justify-between text-sm font-semibold text-emerald-600 border-t border-emerald-100 pt-2">
                <span>Total Margin</span>
                <span>+{formatCurrency(
                  (materialMarginEnabled ? totals.totalMaterials * parseFloat(materialMarginPercent || '0') / 100 : 0) +
                  (laborMarginEnabled ? totals.totalLabour * parseFloat(laborMarginPercent || '0') / 100 : 0),
                  effectiveCurrency
                )}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span>Subtotal</span>
              <span>{formatCurrency(
                totals.totalMaterials + totals.totalLabour +
                (materialMarginEnabled ? totals.totalMaterials * parseFloat(materialMarginPercent || '0') / 100 : 0) +
                (laborMarginEnabled ? totals.totalLabour * parseFloat(laborMarginPercent || '0') / 100 : 0),
                effectiveCurrency
              )}</span>
            </div>
            {totals.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax ({quote.tax_rate}%)</span>
                <span>{formatCurrency(totals.tax, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">● = value overridden from template default</p>
          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={() => setPhase('extras')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              ← Back to Extras
            </button>
            {/* Guard removed per Shaun: areas are optional for generic quotes
                and the roofing guard was more friction than value. Just show
                the ConfirmQuoteButton directly. */}
            <ConfirmQuoteButton
              quoteId={quote.id}
              workspaceSlug={workspaceSlug}
              quoteStatus={quote.status}
              onBeforeSubmit={handleSaveMargins}
            />
          </div>
        </div>
      )}
    </section>
    <ConfirmModal
      open={showEmptyQuoteGuard !== null}
      title={showEmptyQuoteGuard === 'no-main-components' ? 'Add at least one component' : `Add at least one ${tradeLabels.areaSingularLabel.toLowerCase()}`}
      description={
        showEmptyQuoteGuard === 'no-main-components'
          ? `Your quote has a ${tradeLabels.areaSingularLabel.toLowerCase()} but no main components yet. Add at least one component before saving the quote.`
          : tradeLabels.emptyAreaGuardMessage
      }
      confirmLabel="OK, take me there"
      cancelLabel="Stay here"
      destructive={false}
      onCancel={() => setShowEmptyQuoteGuard(null)}
      onConfirm={() => {
        // Bounce to the right step: if there's no area at all we go to
        // Roof Areas; if there's an area but no main components, we go
        // straight to the Components phase where they pick from the
        // library.
        const target = showEmptyQuoteGuard === 'no-main-components' ? 'components' : 'areas';
        setShowEmptyQuoteGuard(null);
        setPhase(target);
      }}
    />
    <ConfirmModal
      open={areaPendingDelete !== null}
      title={`Remove ${tradeLabels.areaSingularLabel.toLowerCase()}`}
      description={
        areaPendingDelete
          ? `Remove "${areaPendingDelete.label}"? Every component attached to this area (and their entries, customer-quote lines, and labor-sheet lines) will also be deleted. This cannot be undone.`
          : ''
      }
      confirmLabel="Remove area + components"
      pendingLabel="Removing..."
      pending={areaDeleting}
      onCancel={() => { if (!areaDeleting) setAreaPendingDelete(null); }}
      onConfirm={confirmRemoveArea}
    />
    {showCreateComponentModal && (
      <CreateSmartComponentModal
        measurementSystem={companyMeasurementSystem}
        defaultTrade={companyDefaultTrade}
        defaultComponentType={createCompType}
        collections={collections}
        onCreated={handleComponentCreated}
        onClose={() => setShowCreateComponentModal(false)}
      />
    )}
    </>
  );
}
