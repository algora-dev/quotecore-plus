'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { addQuoteRoofArea, updateQuoteRoofArea, removeQuoteRoofArea, toggleAreaLock, addRoofAreaEntry, removeRoofAreaEntry, addQuoteComponent, removeQuoteComponent, addComponentEntry, removeComponentEntry, updateComponentSettings, useRoofAreaTotal, updateQuoteMargins } from '../actions';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import { unitForMeasurement, entryLabel, addMoreLabel } from '@/app/lib/types';
import { convertArea, convertLinearToMetric, convertAreaToMetric } from '@/app/lib/measurements/conversions';
import { formatArea, formatLinear, getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import type { QuoteRow, QuoteRoofAreaRow, QuoteRoofAreaEntryRow, QuoteComponentRow, QuoteComponentEntryRow, ComponentLibraryRow, InputMode } from '@/app/lib/types';
import { MeasurementSystemToggle } from './MeasurementSystemToggle';
import { QuoteNameEditor } from './QuoteNameEditor';
import { ConfirmQuoteButton } from './ConfirmQuoteButton';
import { CurrencySelector } from './CurrencySelector';
import { FilesManager } from './FilesManager';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { useCopilot } from '@/app/components/copilot/CopilotProvider';
import { ConfirmModal } from '@/app/components/ConfirmModal';

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
  takeoffData?: any[];
  externalPhase?: Phase; // NEW: For URL-based navigation (v2)
  onPhaseChange?: (phase: Phase) => void; // NEW: Callback when phase changes
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
  takeoffData = [],
  externalPhase,
  onPhaseChange
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
  const { state: copilotState } = useCopilot();
  
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
  const copilotActive = copilotState.enabled && copilotState.activeGuide === 'quote-builder';
  const hasUnconfirmedArea = roofAreas.some(a => !a.is_locked);
  const [roofAreaEntries, setRoofAreaEntries] = useState(initialRoofAreaEntries);
  const [components, setComponents] = useState(initialComponents);
  const [entries, setEntries] = useState(initialEntries);
  const [newAreaLabel, setNewAreaLabel] = useState('');
  const [areaPendingDelete, setAreaPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [areaDeleting, setAreaDeleting] = useState(false);

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
    // Convert imperial inputs to metric for storage
    const widthM = quote.measurement_system === 'imperial' ? convertLinearToMetric(widthInput) : widthInput;
    const lengthM = quote.measurement_system === 'imperial' ? convertLinearToMetric(lengthInput) : lengthInput;
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
    setAreaPendingDelete({ id, label: area?.label || 'this roof area' });
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
      alert(err instanceof Error ? err.message : 'Failed to delete roof area');
    } finally {
      setAreaDeleting(false);
    }
  }

  async function handleAddFromLibrary(libId: string, areaId: string | null, type: 'main' | 'extra') {
    const lib = libraryComponents.find(c => c.id === libId);
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

  async function handleRemoveComponent(id: string) {
    await removeQuoteComponent(id);
    setComponents(prev => prev.filter(c => c.id !== id));
    setEntries(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  async function handleAddEntry(compId: string, rawInputValue: number) {
    const comp = components.find(c => c.id === compId);
    // Convert imperial inputs to metric for storage
    let rawValue = rawInputValue;
    if (quote.measurement_system === 'imperial') {
      if (comp?.measurement_type === 'area') {
        rawValue = convertAreaToMetric(rawInputValue);
      } else if (comp?.measurement_type === 'lineal') {
        rawValue = convertLinearToMetric(rawInputValue);
      }
      // quantity/fixed pass through unchanged
    }
    const areaPitch = comp?.quote_roof_area_id
      ? roofAreas.find(a => a.id === comp.quote_roof_area_id)?.calc_pitch_degrees ?? null
      : null;
    const entry = await addComponentEntry(compId, rawValue, areaPitch);
    setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
    const compEntries = [...(entries[compId] ?? []), entry];
    const totalQty = compEntries.reduce((s, e) => s + Number(e.value_after_waste), 0);
    setComponents(prev => prev.map(c => c.id === compId ? {
      ...c,
      final_quantity: totalQty,
      material_cost: totalQty * c.material_rate,
      labour_cost: totalQty * c.labour_rate
    } : c));
  }

  async function handleUseRoofArea(compId: string, roofAreaSqm: number) {
    const comp = components.find(c => c.id === compId);
    // Roof area total is already pitched - don't apply pitch again
    const entry = await useRoofAreaTotal(compId, roofAreaSqm, null);
    setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
    const compEntries = [...(entries[compId] ?? []), entry];
    const totalQty = compEntries.reduce((s, e) => s + Number(e.value_after_waste), 0);
    setComponents(prev => prev.map(c => c.id === compId ? {
      ...c,
      final_quantity: totalQty,
      material_cost: totalQty * c.material_rate,
      labour_cost: totalQty * c.labour_rate
    } : c));
  }

  async function handleRemoveEntry(entryId: string, compId: string) {
    await removeComponentEntry(entryId, compId);
    const updated = (entries[compId] ?? []).filter(e => e.id !== entryId);
    setEntries(prev => ({ ...prev, [compId]: updated }));
    const totalQty = updated.reduce((s, e) => s + Number(e.value_after_waste), 0);
    setComponents(prev => prev.map(c => c.id === compId ? {
      ...c,
      final_quantity: totalQty,
      material_cost: totalQty * c.material_rate,
      labour_cost: totalQty * c.labour_rate
    } : c));
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

  const phases: { key: Phase; label: string }[] = [
    { key: 'areas', label: '1. Roof Areas' },
    { key: 'components', label: '2. Components' },
    { key: 'extras', label: '3. Extras' },
    { key: 'review', label: '4. Review' },
  ];

  // Save margin settings
  const handleSaveMargins = async () => {
    const matPercent = parseFloat(materialMarginPercent);
    const labPercent = parseFloat(laborMarginPercent);

    if (isNaN(matPercent) || matPercent < 0 || matPercent > 100) {
      alert('Material margin must be between 0 and 100%');
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

      // Refresh to recalculate totals
      window.location.reload();
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
      <div className="flex items-start justify-between">
        <div>
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
        <div className="flex items-center gap-3">
          {quote.status === 'draft' && (
            <>
              <MeasurementSystemToggle 
                quoteId={quote.id} 
                currentSystem={quote.measurement_system}
                isDraft={quote.status === 'draft'}
              />
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

      {/* Files & Documents (Roof Plan + Supporting) */}
      <FilesManager 
        quoteId={quote.id}
        companyId={quote.company_id}
        workspaceSlug={workspaceSlug}
        planUrl={planUrl}
        planName={planName}
        supportingFiles={supportingFiles}
      />

      <nav className="flex gap-1 p-1 bg-slate-100 rounded-lg">
        {phases.map(p => (
          <button
            key={p.key}
            onClick={() => setPhase(p.key)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-full transition ${
              phase === p.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <div className="flex gap-4 p-3 bg-slate-50 rounded-lg text-sm">
        <span>Roof: <strong>{formatArea(totalRoofSqm, quote.measurement_system)}</strong></span>
        <span>Materials: <strong>{formatCurrency(totals.totalMaterials, effectiveCurrency)}</strong></span>
        <span>Labour: <strong>{formatCurrency(totals.totalLabour, effectiveCurrency)}</strong></span>
        <span className="ml-auto font-semibold">Total: {formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
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
          {/* Hide add-area input during copilot if there's an unconfirmed area */}
          {(!copilotActive || !hasUnconfirmedArea) && (
          <div className="flex gap-2" data-copilot="quote-add-area-row">
            <input
              value={newAreaLabel}
              onChange={e => setNewAreaLabel(e.target.value)}
              placeholder="e.g. Main Roof, Garage"
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
              Add Roof Area
            </button>
          </div>
          )}
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
                    copilotId={areaIdx === 0 && compIdx === 0 ? 'quote-first-component' : undefined}
                  />
                ))}
                <AddFromLibrary
                  library={libraryComponents.filter(c => c.component_type === 'main')}
                  onAdd={libId => handleAddFromLibrary(libId, area.id, 'main')}
                  copilotId={areaIdx === 0 ? 'quote-add-from-library' : undefined}
                />
              </div>
            );
          })}
          <div className="flex justify-between">
            <button
              onClick={() => setPhase('areas')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              ← Roof Areas
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
              />
            ))}
            <AddFromLibrary
              library={libraryComponents.filter(c => c.component_type === 'extra')}
              onAdd={libId => handleAddFromLibrary(libId, null, 'extra')}
            />
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setPhase('components')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              ← Components
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
                  {area.label} — {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
                </h3>
                {areaComps.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b">
                        <th className="py-1">Component</th>
                        <th className="py-1 text-right">Entries</th>
                        <th className="py-1 text-right">Total Qty</th>
                        <th className="py-1 text-right">Material</th>
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
                            {formatQuantity(c.final_quantity ?? 0, c.measurement_type)}
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

          {extraComps.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-slate-900 mb-2">Extras</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-1">Extra</th>
                    <th className="py-1 text-right">Entries</th>
                    <th className="py-1 text-right">Total Qty</th>
                    <th className="py-1 text-right">Material</th>
                    <th className="py-1 text-right">Labour</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {extraComps.map(c => (
                    <tr key={c.id} className="border-b border-amber-100">
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 text-right">{(entries[c.id] ?? []).length}</td>
                      <td className="py-1.5 text-right">{(c.final_quantity ?? 0).toFixed(1)}</td>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">💸 Profit Margins</h3>
                <p className="text-sm text-gray-600 mt-1">Adjust your profit margins for this quote</p>
              </div>
              <button
                onClick={handleSaveMargins}
                disabled={marginSaving}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-medium disabled:opacity-50 text-s transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {marginSaving ? 'Saving...' : 'Apply Changes'}
              </button>
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
                  <span className="font-semibold text-gray-900">Material Margin</span>
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
                  <span className="font-semibold text-gray-900">Labor Margin</span>
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
              <span>Total Materials</span>
              <span>{formatCurrency(totals.totalMaterials, effectiveCurrency)}</span>
            </div>
            {materialMarginEnabled && parseFloat(materialMarginPercent) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span className="ml-4 text-xs">+ Material Margin ({materialMarginPercent}%)</span>
                <span>+{formatCurrency(totals.totalMaterials * parseFloat(materialMarginPercent) / 100, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Total Labour</span>
              <span>{formatCurrency(totals.totalLabour, effectiveCurrency)}</span>
            </div>
            {laborMarginEnabled && parseFloat(laborMarginPercent) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span className="ml-4 text-xs">+ Labor Margin ({laborMarginPercent}%)</span>
                <span>+{formatCurrency(totals.totalLabour * parseFloat(laborMarginPercent) / 100, effectiveCurrency)}</span>
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
            <ConfirmQuoteButton quoteId={quote.id} workspaceSlug={workspaceSlug} quoteStatus={quote.status} />
          </div>
        </div>
      )}
    </section>
    <ConfirmModal
      open={areaPendingDelete !== null}
      title="Remove roof area"
      description={
        areaPendingDelete
          ? `Remove "${areaPendingDelete.label}" and any of its components? This cannot be undone.`
          : ''
      }
      confirmLabel="Remove"
      pendingLabel="Removing..."
      pending={areaDeleting}
      onCancel={() => { if (!areaDeleting) setAreaPendingDelete(null); }}
      onConfirm={confirmRemoveArea}
    />
    </>
  );
}

function RoofAreaCard({
  area,
  entries,
  quote,
  onUpdate,
  onToggleLock,
  onAddEntry,
  onRemoveEntry,
  onRemove
}: {
  area: QuoteRoofAreaRow;
  entries: QuoteRoofAreaEntryRow[];
  quote: QuoteRow;
  onUpdate: (id: string, updates: Parameters<typeof updateQuoteRoofArea>[1]) => Promise<void>;
  onToggleLock: (id: string, locked: boolean) => Promise<void>;
  onAddEntry: (areaId: string, widthM: number, lengthM: number) => Promise<void>;
  onRemoveEntry: (entryId: string, areaId: string) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [widthInput, setWidthInput] = useState('');
  const [lengthInput, setLengthInput] = useState('');
  const widthRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const w = Number(widthInput);
    const l = Number(lengthInput);
    if (!w || w <= 0 || !l || l <= 0) return;
    await onAddEntry(area.id, w, l);
    setWidthInput('');
    setLengthInput('');
    widthRef.current?.focus();
  }

  function startAdding() {
    setAdding(true);
    setTimeout(() => widthRef.current?.focus(), 50);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {area.is_locked ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{area.label}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-600">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
                {area.calc_pitch_degrees ? ` @ ${area.calc_pitch_degrees}°` : ''}
              </span>
              <button
                onClick={() => onToggleLock(area.id, false)}
                className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
              >
                Edit
              </button>
              <button onClick={() => onRemove(area.id)} className="text-xs text-red-500">
                ×
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">{area.label}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-600">
                {formatArea(area.computed_sqm ?? 0, quote.measurement_system)}
              </span>
              <button onClick={() => onRemove(area.id)} className="text-xs text-red-500">
                ×
              </button>
            </div>
          </div>
          <div>
              <div className="flex items-center gap-2 mb-2" data-copilot="quote-pitch">
                <label className="text-xs text-slate-500">Pitch (°)</label>
                <input
                  type="number"
                  step="0.5"
                  defaultValue={area.calc_pitch_degrees ?? ''}
                  onBlur={e =>
                    onUpdate(area.id, {
                      input_mode: 'calculated',
                      calc_width_m: area.calc_width_m,
                      calc_length_m: area.calc_length_m,
                      calc_plan_sqm: area.calc_plan_sqm,
                      calc_pitch_degrees: Number(e.target.value) || null
                    })
                  }
                  className="w-20 px-2 py-1 text-xs border border-slate-300 rounded"
                />
              </div>
              {entries.map((entry, idx) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs mb-1">
                  <span className="text-slate-400 w-6">#{idx + 1}</span>
                  <span className="text-slate-700">
                    {formatLinear(entry.width_m, quote.measurement_system)} × {formatLinear(entry.length_m, quote.measurement_system)} = {formatArea(entry.sqm, quote.measurement_system)}
                  </span>
                  <button
                    onClick={() => onRemoveEntry(entry.id, area.id)}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              {adding ? (
                <div className="flex items-center gap-2 mt-2" data-copilot="quote-measurement-inputs">
                  <input
                    ref={widthRef}
                    type="number"
                    step="0.01"
                    value={widthInput}
                    onChange={e => setWidthInput(e.target.value)}
                    placeholder={quote.measurement_system === "imperial" ? "Width (ft)" : "Width (m)"}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') {
                        setAdding(false);
                        setWidthInput('');
                        setLengthInput('');
                      }
                    }}
                    className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="number"
                    step="0.01"
                    value={lengthInput}
                    onChange={e => setLengthInput(e.target.value)}
                    placeholder={quote.measurement_system === "imperial" ? "Length (ft)" : "Length (m)"}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') {
                        setAdding(false);
                        setWidthInput('');
                        setLengthInput('');
                      }
                    }}
                    className="w-24 px-2 py-1 text-xs border border-slate-300 rounded"
                  />
                  <button
                    onClick={handleSubmit}
                    className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setWidthInput('');
                      setLengthInput('');
                    }}
                    className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  onClick={startAdding}
                  data-copilot="quote-add-measurement"
                  className="text-xs text-orange-600 hover:text-blue-800 font-medium mt-1"
                >
                  + Add area measurement
                </button>
              )}
            </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onToggleLock(area.id, true)}
              data-copilot="quote-confirm-area"
              className="px-3 py-1 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ExpandableComponent({
  comp,
  entries: compEntries,
  roofAreas,
  roofArea,
  quote,
  currency,
  onAddEntry,
  onUseRoofArea,
  onRemoveEntry,
  onRemove,
  onUpdateSettings,
  copilotId
}: {
  comp: QuoteComponentRow;
  entries: QuoteComponentEntryRow[];
  roofAreas: QuoteRoofAreaRow[];
  roofArea?: QuoteRoofAreaRow;
  quote: QuoteRow;
  currency: string;
  onAddEntry: (compId: string, rawValue: number) => Promise<void>;
  onUseRoofArea?: (compId: string, roofAreaSqm: number) => Promise<void>;
  onRemoveEntry: (entryId: string, compId: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdateSettings: (
    compId: string,
    updates: {
      input_mode?: InputMode;
      quote_roof_area_id?: string | null;
      use_custom_pitch?: boolean;
      custom_pitch_degrees?: number | null;
    }
  ) => Promise<void>;
  copilotId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const unit = getUnitLabel(comp.measurement_type as any, quote.measurement_system);
  const label = entryLabel(comp.measurement_type);
  const addLabel = addMoreLabel(comp.measurement_type);
  const totalCost = (comp.material_cost ?? 0) + (comp.labour_cost ?? 0);
  const hasPitch = comp.pitch_type !== 'none';
  const isAreaBased = comp.measurement_type === 'area';
  const assignedArea = roofAreas.find(a => a.id === comp.quote_roof_area_id);
  const areaPitch = assignedArea?.calc_pitch_degrees ?? 0;

  // Helper to display values with correct units
  function displayValue(value: number): string {
    if (comp.measurement_type === 'area') {
      return formatArea(value, quote.measurement_system);
    }
    if (comp.measurement_type === 'lineal') {
      return formatLinear(value, quote.measurement_system);
    }
    // quantity/fixed types - no unit conversion
    return `${value.toFixed(1)} ${getUnitLabel(comp.measurement_type as any, quote.measurement_system)}`;
  }

  async function handleSubmitEntry() {
    const val = Number(inputValue);
    if (!val || val <= 0) return;
    await onAddEntry(comp.id, val);
    setInputValue('');
    inputRef.current?.focus();
  }

  function startAdding() {
    setAdding(true);
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden" {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs text-slate-400">{expanded ? '▼' : '▶'}</span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-slate-900">{comp.name}</span>
          <span className="text-xs text-slate-400 ml-2">{comp.measurement_type}</span>
        </div>
        <span className="text-xs text-slate-500">
          {compEntries.length} {compEntries.length === 1 ? 'entry' : 'entries'}
        </span>
        <span className="text-xs text-slate-500 w-20 text-right">
          {displayValue(comp.final_quantity ?? 0)}
        </span>
        <span className="text-xs font-medium w-20 text-right">{formatCurrency(totalCost, currency)}</span>
        <button
          onClick={e => {
            e.stopPropagation();
            onRemove(comp.id);
          }}
          className="text-red-400 hover:text-red-600 text-xs ml-1"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Input:</span>
            {(['calculated', 'final'] as InputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => onUpdateSettings(comp.id, { input_mode: mode })}
                className={`px-2 py-0.5 rounded text-xs ${
                  comp.input_mode === mode
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {mode === 'calculated' ? 'Plan' : 'Actual'}
              </button>
            ))}
          </div>

          {roofAreas.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Area:</span>
              <select
                value={comp.quote_roof_area_id ?? ''}
                onChange={e => onUpdateSettings(comp.id, { quote_roof_area_id: e.target.value || null })}
                className="px-2 py-0.5 text-xs border border-slate-300 rounded"
              >
                <option value="">None</option>
                {roofAreas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({(a.calc_pitch_degrees ?? 0).toFixed(1)}°)
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasPitch && comp.input_mode === 'calculated' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Pitch:</span>
              <button
                onClick={() => onUpdateSettings(comp.id, { use_custom_pitch: false })}
                className={`px-2 py-0.5 rounded text-xs ${
                  !comp.use_custom_pitch
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                Area ({areaPitch.toFixed(1)}°)
              </button>
              <button
                onClick={() => onUpdateSettings(comp.id, { use_custom_pitch: true })}
                className={`px-2 py-0.5 rounded text-xs ${
                  comp.use_custom_pitch
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                Custom
              </button>
              {comp.use_custom_pitch && (
                <input
                  type="number"
                  step="0.5"
                  defaultValue={comp.custom_pitch_degrees ?? ''}
                  onBlur={e =>
                    onUpdateSettings(comp.id, {
                      custom_pitch_degrees: Number(e.target.value) || null
                    })
                  }
                  placeholder="°"
                  className="w-16 px-1 py-0.5 text-xs border border-slate-300 rounded"
                />
              )}
            </div>
          )}

          {isAreaBased && roofArea && onUseRoofArea && (
            <button
              onClick={() => onUseRoofArea(comp.id, roofArea.computed_sqm ?? 0)}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
            >
              → Use roof area total ({formatArea(roofArea.computed_sqm ?? 0, quote.measurement_system)})
            </button>
          )}

          {compEntries.map((entry, idx) => (
            <div key={entry.id} className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 w-6">#{idx + 1}</span>
              <span className="text-slate-700">
                {displayValue(entry.raw_value)}
              </span>
              {comp.waste_type !== 'none' && (
                <span className="text-slate-400">
                  → {displayValue(entry.value_after_waste)}{' '}
                  <span className="text-slate-300">(+waste)</span>
                </span>
              )}
              <button
                onClick={() => onRemoveEntry(entry.id, comp.id)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          ))}

          {adding ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSubmitEntry();
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setInputValue('');
                  }
                }}
                placeholder={`Enter ${label}`}
                className="w-32 px-2 py-1 text-xs border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400">{unit}</span>
              <button
                onClick={handleSubmitEntry}
                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setInputValue('');
                }}
                className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={startAdding}
              className="text-xs text-orange-600 hover:text-blue-800 font-medium mt-1"
            >
              + {addLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddFromLibrary({
  library,
  onAdd,
  copilotId
}: {
  library: ComponentLibraryRow[];
  onAdd: (id: string) => Promise<void>;
  copilotId?: string;
}) {
  const [sel, setSel] = useState('');
  return (
    <div className="flex gap-2" {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <select
        value={sel}
        onChange={e => setSel(e.target.value)}
        className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
      >
        <option value="">Add from library...</option>
        {library.map(c => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.measurement_type})
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (sel) {
            onAdd(sel);
            setSel('');
          }
        }}
        disabled={!sel}
        data-copilot={copilotId ? `${copilotId}-add-btn` : undefined}
        className="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}
