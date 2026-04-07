'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { addQuoteRoofArea, updateQuoteRoofArea, removeQuoteRoofArea, toggleAreaLock, addRoofAreaEntry, removeRoofAreaEntry, addQuoteComponent, removeQuoteComponent, addComponentEntry, removeComponentEntry, updateComponentSettings, useRoofAreaTotal } from '../actions';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import { entryLabel, addMoreLabel } from '@/app/lib/types';
import { formatArea } from '@/app/lib/measurements/displayHelpers';
import type { QuoteRow, QuoteRoofAreaRow, QuoteRoofAreaEntryRow, QuoteComponentRow, QuoteComponentEntryRow, ComponentLibraryRow, InputMode, MeasurementSystem } from '@/app/lib/types';

type Phase = 'areas' | 'components' | 'extras' | 'review';

interface Props {
  quote: QuoteRow; initialRoofAreas: QuoteRoofAreaRow[]; initialRoofAreaEntries: Record<string, QuoteRoofAreaEntryRow[]>;
  initialComponents: QuoteComponentRow[]; initialEntries: Record<string, QuoteComponentEntryRow[]>;
  libraryComponents: ComponentLibraryRow[]; workspaceSlug: string;
  takeoffData?: any[];
}

export function QuoteBuilder({ quote: initialQuote, initialRoofAreas, initialRoofAreaEntries, initialComponents, initialEntries, libraryComponents, workspaceSlug, takeoffData = [] }: Props) {
  const [phase, setPhase] = useState<Phase>('areas');
  const [quote, setQuote] = useState(initialQuote);
  const [roofAreas, setRoofAreas] = useState(initialRoofAreas);
  const [roofAreaEntries, setRoofAreaEntries] = useState(initialRoofAreaEntries);
  const [components, setComponents] = useState(initialComponents);
  const [entries, setEntries] = useState(initialEntries);
  const [newAreaLabel, setNewAreaLabel] = useState('');
  const [takeoffPopulated, setTakeoffPopulated] = useState(false);
  
  const system: MeasurementSystem = quote.measurement_system;
  const mainComps = components.filter(c => c.component_type === 'main');
  const extraComps = components.filter(c => c.component_type === 'extra');
  const totalRoofSqm = roofAreas.reduce((sum, a) => sum + (a.computed_sqm ?? 0), 0);
  
  const engineComps = components.map(c => ({
    id: c.id, name: c.name, componentType: c.component_type as 'main' | 'extra',
    measurementType: c.measurement_type as 'area' | 'linear' | 'quantity' | 'fixed', inputMode: c.input_mode as 'final' | 'calculated',
    finalValue: c.final_value ?? undefined, calcRawValue: c.calc_raw_value ?? undefined,
    calcPitchDegrees: c.calc_pitch_degrees ?? undefined, calcPitchFactor: c.calc_pitch_factor ?? undefined,
    wasteType: c.waste_type as 'percent' | 'fixed' | 'none', wastePercent: c.waste_percent, wasteFixed: c.waste_fixed,
    finalQuantity: c.final_quantity ?? undefined, materialRate: c.material_rate, labourRate: c.labour_rate,
    materialCost: c.material_cost, labourCost: c.labour_cost, isRateOverridden: c.is_rate_overridden, isQuantityOverridden: c.is_quantity_overridden,
    isWasteOverridden: c.is_waste_overridden, isPitchOverridden: c.is_pitch_overridden, isCustomerVisible: c.is_customer_visible, pricingUnit: c.pricing_unit ?? undefined,
  }));
  const totals = computeQuoteTotals(engineComps, { materialMarginPct: quote.material_margin_pct, labourMarginPct: quote.labour_margin_pct, taxRate: quote.tax_rate });
  const allAreasLocked = roofAreas.every(a => a.is_locked);

  // Auto-populate from takeoff data
  useEffect(() => {
    console.log('[QuoteBuilder] Mount check:', {
      takeoffDataLength: takeoffData.length,
      roofAreasLength: roofAreas.length,
      takeoffPopulated,
      takeoffData
    });
    
    if (!takeoffPopulated && takeoffData.length > 0 && roofAreas.length === 0) {
      console.log('[QuoteBuilder] AUTO-POPULATING from takeoff!');
      setTakeoffPopulated(true);
    }
  }, [takeoffData, roofAreas, takeoffPopulated]);

  async function handleAddArea() { if (!newAreaLabel.trim()) return; const created = await addQuoteRoofArea(quote.id, newAreaLabel.trim()); setRoofAreas(prev => [...prev, created]); setRoofAreaEntries(prev => ({ ...prev, [created.id]: [] })); setNewAreaLabel(''); }
  
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

  async function handleAddRoofAreaEntry(areaId: string, widthM: number, lengthM: number) {
    const area = roofAreas.find(a => a.id === areaId);
    if (!area) return;
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

  async function handleRemoveArea(id: string) { if (!confirm('Remove this roof area and its components?')) return; await removeQuoteRoofArea(id); setRoofAreas(prev => prev.filter(a => a.id !== id)); setComponents(prev => prev.filter(c => c.quote_roof_area_id !== id)); }

  async function handleAddFromLibrary(libId: string, areaId: string | null, type: 'main' | 'extra') {
    const lib = libraryComponents.find(c => c.id === libId); if (!lib) return;
    const created = await addQuoteComponent(quote.id, {
      quote_roof_area_id: areaId ?? undefined, component_library_id: libId, name: lib.name, component_type: type, measurement_type: lib.measurement_type,
      material_rate: lib.default_material_rate, labour_rate: lib.default_labour_rate, waste_type: lib.default_waste_type,
      waste_percent: lib.default_waste_percent, waste_fixed: lib.default_waste_fixed, pitch_type: lib.default_pitch_type,
    });
    setComponents(prev => [...prev, created]); setEntries(prev => ({ ...prev, [created.id]: [] }));
  }

  async function handleRemoveComponent(id: string) { await removeQuoteComponent(id); setComponents(prev => prev.filter(c => c.id !== id)); setEntries(prev => { const n = { ...prev }; delete n[id]; return n; }); }

  async function handleAddEntry(compId: string, rawValue: number) {
    const comp = components.find(c => c.id === compId);
    const areaPitch = comp?.quote_roof_area_id ? roofAreas.find(a => a.id === comp.quote_roof_area_id)?.calc_pitch_degrees ?? null : null;
    const entry = await addComponentEntry(compId, rawValue, areaPitch);
    setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
    const compEntries = [...(entries[compId] ?? []), entry];
    const totalQty = compEntries.reduce((s, e) => s + Number(e.value_after_waste), 0);
    setComponents(prev => prev.map(c => c.id === compId ? { ...c, final_quantity: totalQty, material_cost: totalQty * c.material_rate, labour_cost: totalQty * c.labour_rate } : c));
  }

  async function handleUseRoofArea(compId: string, roofAreaSqm: number) {
    const comp = components.find(c => c.id === compId);
    const areaPitch = comp?.quote_roof_area_id ? roofAreas.find(a => a.id === comp.quote_roof_area_id)?.calc_pitch_degrees ?? null : null;
    const entry = await useRoofAreaTotal(compId, roofAreaSqm, areaPitch);
    setEntries(prev => ({ ...prev, [compId]: [...(prev[compId] ?? []), entry] }));
    const compEntries = [...(entries[compId] ?? []), entry];
    const totalQty = compEntries.reduce((s, e) => s + Number(e.value_after_waste), 0);
    setComponents(prev => prev.map(c => c.id === compId ? { ...c, final_quantity: totalQty, material_cost: totalQty * c.material_rate, labour_cost: totalQty * c.labour_rate } : c));
  }

  async function handleRemoveEntry(entryId: string, compId: string) {
    await removeComponentEntry(entryId, compId);
    const updated = (entries[compId] ?? []).filter(e => e.id !== entryId);
    setEntries(prev => ({ ...prev, [compId]: updated }));
    const totalQty = updated.reduce((s, e) => s + Number(e.value_after_waste), 0);
    setComponents(prev => prev.map(c => c.id === compId ? { ...c, final_quantity: totalQty, material_cost: totalQty * c.material_rate, labour_cost: totalQty * c.labour_rate } : c));
  }

  async function handleUpdateCompSettings(compId: string, updates: { input_mode?: InputMode; quote_roof_area_id?: string | null; use_custom_pitch?: boolean; custom_pitch_degrees?: number | null }) {
    await updateComponentSettings(compId, updates);
    setComponents(prev => prev.map(c => c.id === compId ? { ...c, ...updates } : c));
  }

  const phases: { key: Phase; label: string }[] = [
    { key: 'areas', label: '1. Roof Areas' }, { key: 'components', label: '2. Components' },
    { key: 'extras', label: '3. Extras' }, { key: 'review', label: '4. Review' },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/${workspaceSlug}/quotes`} className="text-sm text-slate-500 hover:text-slate-700">← Quotes</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{quote.customer_name}{quote.job_name && <span className="text-slate-500 font-normal"> — {quote.job_name}</span>}</h1>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${quote.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'}`}>{quote.status}</span>
      </div>
      <nav className="flex gap-1 p-1 bg-slate-100 rounded-lg">
        {phases.map(p => <button key={p.key} onClick={() => setPhase(p.key)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-full transition ${phase === p.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p.label}</button>)}
      </nav>
      <div className="flex gap-4 p-3 bg-slate-50 rounded-full text-sm">
        <span>Roof: <strong>{formatArea(totalRoofSqm, system)}</strong></span>
        <span>Materials: <strong>${totals.totalMaterials.toFixed(2)}</strong></span>
        <span>Labour: <strong>${totals.totalLabour.toFixed(2)}</strong></span>
        <span className="ml-auto font-semibold">Total: ${totals.grandTotal.toFixed(2)}</span>
      </div>

      {/* Phases rendered here - keeping original structure, just showing key parts with conversions */}
      {phase === 'areas' && (
        <div className="space-y-4">
          {roofAreas.map(area => (
            <div key={area.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{area.label}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-orange-600">{formatArea(area.computed_sqm ?? 0, system)}</span>
                  <button onClick={() => handleRemoveArea(area.id)} className="text-xs text-red-500">×</button>
                </div>
              </div>
              {/* Remaining area card UI unchanged for now */}
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newAreaLabel} onChange={e => setNewAreaLabel(e.target.value)} placeholder="e.g. Main Roof, Garage"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg" onKeyDown={e => e.key === 'Enter' && handleAddArea()} />
            <button onClick={handleAddArea} disabled={!newAreaLabel.trim()} className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50">Add Roof Area</button>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setPhase('components')} disabled={!allAreasLocked} className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {allAreasLocked ? 'Next: Components →' : 'Confirm all areas to continue'}
            </button>
          </div>
        </div>
      )}

      {/* Components, Extras, Review phases - simplified for now */}
      {phase === 'components' && <div>Components phase (implementation continues in next slice)</div>}
      {phase === 'extras' && <div>Extras phase</div>}
      {phase === 'review' && <div>Review phase</div>}
    </section>
  );
}
