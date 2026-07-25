'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { trackEvent } from '@/lib/analytics';
import type { ComponentKind, Entry, ComponentSection, RoofComponentDef, InputMode } from './types';
import {
  COMPONENT_DEFS,
  COMPONENT_ORDER,
  computeEntry,
  computeMaterialCost,
  computeLabourCost,
  makeEntry,
  makeInitialSections,
} from './calc';
import { ResultsModal } from './ResultsModal';

type MeasureMode = 'actual' | 'plan';

export function RoofTakeoffBuilder() {
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  const [sections, setSections] = useState<Record<ComponentKind, ComponentSection>>(makeInitialSections);
  const [masterPitch, setMasterPitch] = useState('25');
  const [expandedSection, setExpandedSection] = useState<ComponentKind | null>('roof_area');
  const [showResults, setShowResults] = useState(false);
  const [components, setComponents] = useState<RoofComponentDef[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/free-tools/roof-components')
      .then(r => r.json())
      .then(data => { if (data.components) setComponents(data.components); })
      .catch(() => {})
      .finally(() => setComponentsLoading(false));
  }, []);

  const componentsByKind = useMemo(() => {
    const map: Record<ComponentKind, RoofComponentDef[]> = {} as any;
    for (const kind of COMPONENT_ORDER) {
      map[kind] = components.filter(c => c.component_kind === kind);
    }
    return map;
  }, [components]);

  const getComponentById = useCallback((id: string | null): RoofComponentDef | null => {
    if (!id) return null;
    return components.find(c => c.id === id) ?? null;
  }, [components]);

  const addEntry = (kind: ComponentKind) => {
    const pitch = parseFloat(masterPitch) || 25;
    const firstComp = componentsByKind[kind]?.[0];
    setSections(prev => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        entries: [...prev[kind].entries, { ...makeEntry(pitch), selectedComponentId: firstComp?.id ?? null }],
      },
    }));
  };

  const removeEntry = (kind: ComponentKind, entryId: string) => {
    setSections(prev => ({ ...prev, [kind]: { ...prev[kind], entries: prev[kind].entries.filter(e => e.id !== entryId) } }));
  };

  const updateEntry = (kind: ComponentKind, entryId: string, updates: Partial<Entry>) => {
    setSections(prev => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        entries: prev[kind].entries.map(e => {
          if (e.id !== entryId) return e;
          const updated = { ...e, ...updates };
          updated.computedValue = computeEntry(updated, kind);
          return updated;
        }),
      },
    }));
  };

  const updateWaste = (kind: ComponentKind, waste: number) => {
    setSections(prev => ({ ...prev, [kind]: { ...prev[kind], wastePercent: waste } }));
  };

  const totals = useMemo(() => {
    const result: Record<ComponentKind, { rawTotal: number; withWaste: number; count: number; materialCost: number; labourCost: number; totalCost: number }> = {} as any;
    for (const kind of COMPONENT_ORDER) {
      const section = sections[kind];
      const rawTotal = section.entries.reduce((sum, e) => sum + e.computedValue, 0);
      const withWaste = rawTotal * (1 + section.wastePercent / 100);
      let materialCost = 0, labourCost = 0;
      for (const entry of section.entries) {
        const comp = getComponentById(entry.selectedComponentId);
        materialCost += computeMaterialCost(entry.computedValue, comp).cost;
        labourCost += computeLabourCost(entry.computedValue, comp);
      }
      result[kind] = { rawTotal, withWaste, count: section.entries.length, materialCost, labourCost, totalCost: materialCost + labourCost };
    }
    return result;
  }, [sections, getComponentById]);

  const totalEntries = COMPONENT_ORDER.reduce((sum, k) => sum + sections[k].entries.length, 0);
  const hasData = totalEntries > 0;
  const grandTotal = COMPONENT_ORDER.reduce((sum, k) => sum + totals[k].totalCost, 0);
  const cur = '£';

  const generateResults = () => {
    if (!hasData) return;
    setShowResults(true);
    trackEvent('free_roof_builder_generate', { entries: totalEntries });
  };

  return (
    <FreeToolsAuthProvider>
      <main className="min-h-screen bg-white">
        <BlogHeader />
        <section className="relative overflow-hidden border-b border-slate-100">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.06),transparent_60%)]" />
          <div className="relative mx-auto max-w-5xl px-2 md:px-6 pt-8 md:pt-12 pb-4 md:pb-6 text-center">
            <h1 className="text-xl md:text-3xl font-semibold tracking-tight text-slate-900">Free Roof Takeoff Builder</h1>
            <p className="mt-2 md:mt-3 text-sm md:text-base text-slate-500 max-w-2xl mx-auto px-2">
              Input all your roof measurements in one place. Apply pitch, calculate lengths, and get a complete material takeoff with pricing — no signup required.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-2 md:px-6 py-6 md:py-10 pb-20 md:pb-10">
          {/* Step 1: Measurement Mode Selection */}
          {!measureMode && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">How do you want to enter your measurements?</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the method that matches your measurements. You can mix and match per component later.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Actual measurements */}
                <button
                  onClick={() => { setMeasureMode('actual'); setExpandedSection('roof_area'); }}
                  className="group rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] min-h-[180px] flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <InfoIcon text="Use this if you've already measured the roof (e.g. with a tape, laser, or from software) and have the real final lengths and areas. The system just records what you enter and adds waste." />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">I have actual measurements</h3>
                  <p className="mt-1 text-sm text-slate-500 flex-1">
                    You already have final roof dimensions (real lengths, real areas). Just type them in — no pitch calculation needed.
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#FF6B35] opacity-0 group-hover:opacity-100 transition">
                    Start entering measurements
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Plan / Pitch calculation */}
                <button
                  onClick={() => { setMeasureMode('plan'); setExpandedSection('roof_area'); }}
                  className="group rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] min-h-[180px] flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <InfoIcon text="Use this if you're measuring off a plan view (top-down drawing or PDF). You enter the plan lengths and the roof pitch, and the system calculates the real sloped lengths and areas for you." />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">I'm measuring from a plan</h3>
                  <p className="mt-1 text-sm text-slate-500 flex-1">
                    You have a top-down roof plan. Enter plan dimensions and the roof pitch — we'll calculate the real sloped lengths and areas automatically.
                  </p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#FF6B35] opacity-0 group-hover:opacity-100 transition">
                    Start calculating from plan
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Component sections */}
          {measureMode && (
            <>
              {/* Mode indicator + change button */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-4 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${measureMode === 'actual' ? 'bg-blue-500' : 'bg-[#FF6B35]'}`} />
                  <span className="text-sm font-medium text-slate-700">
                    {measureMode === 'actual' ? 'Actual Measurements Mode' : 'Plan + Pitch Calculation Mode'}
                  </span>
                </div>
                <button
                  onClick={() => setMeasureMode(null)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100"
                >
                  Change mode
                </button>
              </div>

              {/* Pitch control (only in plan mode) */}
              {measureMode === 'plan' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">Roof Pitch</span>
                      <InfoIcon text="Roof pitch is the angle of the roof slope in degrees. E.g. 25° is a common UK roof pitch. We use this to calculate the real sloped lengths from your plan measurements." />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input type="number" value={masterPitch} onChange={(e) => setMasterPitch(e.target.value)}
                          min={0} max={89} step={0.5} inputMode="decimal"
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-orange-500 focus:outline-none" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">°</span>
                      </div>
                      <span className="text-xs text-slate-400">degrees (applies to all entries)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Component Sections */}
              <div className="space-y-3">
                {COMPONENT_ORDER.map(kind => {
                  const def = COMPONENT_DEFS[kind];
                  const section = sections[kind];
                  const isExpanded = expandedSection === kind;
                  const total = totals[kind];
                  const hasEntries = section.entries.length > 0;

                  return (
                    <div key={kind} className={`rounded-xl border bg-white transition ${isExpanded ? 'border-slate-300 shadow-sm' : 'border-slate-200'}`}>
                      <button onClick={() => setExpandedSection(isExpanded ? null : kind)}
                        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-orange-50/40 transition rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: def.colour }} />
                          <span className="text-sm font-semibold text-slate-900">{def.label}</span>
                          {hasEntries && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              {section.entries.length} {section.entries.length === 1 ? 'entry' : 'entries'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {hasEntries && (
                            <div className="text-right">
                              <span className="text-sm font-semibold text-slate-900">{total.rawTotal.toFixed(2)} {def.unit}</span>
                              {total.totalCost > 0 && <span className="ml-2 text-xs text-[#FF6B35] font-medium">{cur}{total.totalCost.toFixed(2)}</span>}
                              {section.wastePercent > 0 && <span className="ml-2 text-xs text-slate-400">+{section.wastePercent}%</span>}
                            </div>
                          )}
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 p-4 space-y-3">
                          {/* Waste control */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                              Waste
                              <InfoIcon text="Waste adds extra material to account for cuts, breaks, and overlaps. E.g. 10% waste on 100m² means you'll order 110m²." />
                            </label>
                            <div className="relative">
                              <input type="number" value={section.wastePercent} onChange={(e) => updateWaste(kind, parseFloat(e.target.value) || 0)}
                                min={0} max={100} step={1} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm text-center focus:border-orange-500 focus:outline-none" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                            </div>
                          </div>

                          {section.entries.map((entry, idx) => (
                            <EntryRow key={entry.id} entry={entry} index={idx} kind={kind} measureMode={measureMode}
                              availableComponents={componentsByKind[kind] || []} componentsLoading={componentsLoading}
                              onUpdate={(updates) => updateEntry(kind, entry.id, updates)} onRemove={() => removeEntry(kind, entry.id)}
                              getComponentById={getComponentById} />
                          ))}

                          <button onClick={() => addEntry(kind)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 hover:border-[#FF6B35] hover:text-[#FF6B35] transition">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add {def.label} Entry
                          </button>

                          {!hasEntries && (
                            <p className="text-xs text-slate-400 text-center py-2">No {def.label.toLowerCase()} entries yet. Click above to add one.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary Bar */}
              {hasData && (
                <div className="mt-6 rounded-xl bg-slate-900 text-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Summary</h3>
                    <span className="text-xs text-slate-400">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} total</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COMPONENT_ORDER.map(kind => {
                      const def = COMPONENT_DEFS[kind];
                      const t = totals[kind];
                      if (t.count === 0) return null;
                      return (
                        <div key={kind} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: def.colour }} />
                            <span className="text-xs text-slate-300">{def.label}</span>
                          </div>
                          <div className="mt-1 text-sm font-semibold">{t.rawTotal.toFixed(2)} {def.unit}</div>
                          {sections[kind].wastePercent > 0 && <div className="text-xs text-slate-400">w/ waste: {t.withWaste.toFixed(2)} {def.unit}</div>}
                          {t.totalCost > 0 && <div className="text-xs text-[#FF6B35] font-medium mt-0.5">{cur}{t.totalCost.toFixed(2)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {grandTotal > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-sm font-semibold">Estimated Total</span>
                      <span className="text-xl font-bold">{cur}{grandTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <button onClick={generateResults}
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] min-h-[44px]">
                    Generate Takeoff Report
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              {!hasData && (
                <div className="mt-6 rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
                  <svg className="mx-auto w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
                  </svg>
                  <p className="mt-3 text-sm text-slate-500">Start by adding measurements for any roof component above.</p>
                  <p className="mt-1 text-xs text-slate-400">Expand a section and click &quot;Add Entry&quot; to begin.</p>
                </div>
              )}
            </>
          )}
        </div>

        {showResults && (
          <ResultsModal sections={sections} totals={totals} getComponentById={getComponentById} grandTotal={grandTotal} onClose={() => setShowResults(false)} />
        )}

        <SiteFooter />
      </main>
    </FreeToolsAuthProvider>
  );
}

// ─── Info Icon (hover/click tooltip) ─────────────────

function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        className="text-slate-300 hover:text-slate-500 transition rounded-full p-0.5"
        aria-label="More info"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-lg bg-slate-900 text-white text-xs p-3 shadow-lg pointer-events-none">
          {text}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ─── Entry Row Component ─────────────────────────────

interface EntryRowProps {
  entry: Entry;
  index: number;
  kind: ComponentKind;
  measureMode: MeasureMode;
  availableComponents: RoofComponentDef[];
  componentsLoading: boolean;
  onUpdate: (updates: Partial<Entry>) => void;
  onRemove: () => void;
  getComponentById: (id: string | null) => RoofComponentDef | null;
}

function EntryRow({ entry, index, kind, measureMode, availableComponents, onUpdate, onRemove, getComponentById }: EntryRowProps) {
  const def = COMPONENT_DEFS[kind];
  const isRoofArea = kind === 'roof_area';
  const usePitch = measureMode === 'plan' && def.pitchType !== 'none';

  // Force input mode based on the global measureMode
  const effectiveMode: InputMode = usePitch ? 'pitch_calculated' : 'actual';

  const selectedComp = getComponentById(entry.selectedComponentId);
  const compCost = selectedComp ? computeMaterialCost(entry.computedValue, selectedComp) : { cost: 0, packs: 0 };
  const labourCost = selectedComp ? computeLabourCost(entry.computedValue, selectedComp) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Entry {index + 1}</span>
        <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition p-1" aria-label="Remove entry">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {isRoofArea ? (
          usePitch ? (
            <>
              <NumField label="Plan Width (m)" value={entry.planWidth} onChange={(v) => onUpdate({ planWidth: v, inputMode: effectiveMode })} />
              <NumField label="Plan Length (m)" value={entry.planLengthVal} onChange={(v) => onUpdate({ planLengthVal: v, inputMode: effectiveMode })} />
            </>
          ) : (
            <div className="col-span-2">
              <NumField label="Actual Area (m²)" value={entry.actualValue} onChange={(v) => onUpdate({ actualValue: v, inputMode: effectiveMode })} />
            </div>
          )
        ) : (
          usePitch ? (
            <div className="col-span-2">
              <NumField label="Plan Length (m)" value={entry.planLength} onChange={(v) => onUpdate({ planLength: v, inputMode: effectiveMode })} />
            </div>
          ) : (
            <div className="col-span-2">
              <NumField label={`Actual Length (${def.unit})`} value={entry.actualValue} onChange={(v) => onUpdate({ actualValue: v, inputMode: effectiveMode })} />
            </div>
          )
        )}
        <div className="rounded-lg bg-orange-50/50 border border-orange-100 px-3 py-1.5">
          <div className="text-xs text-slate-500">Computed</div>
          <div className="text-sm font-semibold text-slate-900">{entry.computedValue.toFixed(2)} {def.unit}</div>
          {selectedComp && compCost.cost > 0 && (
            <div className="text-xs text-[#FF6B35] font-medium">£{(compCost.cost + labourCost).toFixed(2)}</div>
          )}
        </div>
      </div>

      {availableComponents.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600">Component</label>
          <select value={entry.selectedComponentId || ''}
            onChange={(e) => onUpdate({ selectedComponentId: e.target.value || null })}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:border-orange-500 focus:outline-none">
            <option value="">— No component (lengths only) —</option>
            {availableComponents.map(comp => (
              <option key={comp.id} value={comp.id}>
                {comp.name} (£{comp.price_per_unit.toFixed(2)}/{comp.unit}){comp.description ? ` — ${comp.description}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <input type="text" value={entry.label} onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Optional label (e.g. Front gable, Main roof)"
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 focus:border-orange-500 focus:outline-none" />
    </div>
  );
}

function NumField({ label, value, onChange, step = 0.1, min = 0, max }: { label: string; value: number | undefined; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input type="number" value={value ?? ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step} inputMode="decimal"
        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
    </div>
  );
}
