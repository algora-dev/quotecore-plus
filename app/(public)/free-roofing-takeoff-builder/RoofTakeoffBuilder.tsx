'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { trackEvent } from '@/lib/analytics';
import type { ComponentKind, Entry, ComponentSection, RoofComponentDef } from './types';
import {
  COMPONENT_DEFS,
  COMPONENT_ORDER,
  computeEntry,
  computeMaterialCost,
  computeLabourCost,
  makeId,
  makeInitialSections,
} from './calc';
import { ResultsModal } from './ResultsModal';
import { EntryListItem, AddEntryForm } from './EntryComponents';
import {
  InfoIcon,
  ComponentSymbol,
  componentLabel,
  unitLabel,
  areaUnitLabel,
  ratioToDegrees,
  degreesToRatio,
} from './helpers';

type MeasureMode = 'actual' | 'plan';
type UnitSystem = 'metric' | 'imperial' | 'squares';

export function RoofTakeoffBuilder() {
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(null);
  const [pitchMode, setPitchMode] = useState<'degrees' | 'ratio'>('degrees');
  const [sections, setSections] = useState<Record<ComponentKind, ComponentSection>>(makeInitialSections);
  const [masterPitch, setMasterPitch] = useState('25');
  const [masterRatio, setMasterRatio] = useState('5:12');
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
    for (const kind of COMPONENT_ORDER) map[kind] = components.filter(c => c.component_kind === kind);
    return map;
  }, [components]);

  const getComponentById = useCallback((id: string | null): RoofComponentDef | null => {
    if (!id) return null;
    return components.find(c => c.id === id) ?? null;
  }, [components]);

  const updatePitchDegrees = (val: string) => {
    setMasterPitch(val);
    const deg = parseFloat(val) || 0;
    setMasterRatio(degreesToRatio(deg, unitSystem || 'imperial'));
  };
  const updatePitchRatio = (val: string) => {
    setMasterRatio(val);
    const deg = ratioToDegrees(val);
    if (deg > 0) setMasterPitch(deg.toFixed(1));
  };

  const effectivePitch = parseFloat(masterPitch) || 0;

  const addEntry = (kind: ComponentKind, entry: Entry) => {
    setSections(prev => ({
      ...prev,
      [kind]: { ...prev[kind], entries: [...prev[kind].entries, entry] },
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
  const cur = '\u00A3';

  const generateResults = () => {
    if (!hasData) return;
    setShowResults(true);
    trackEvent('free_roof_builder_generate', { entries: totalEntries });
  };

  const u = unitSystem || 'metric';
  const lenLbl = unitLabel(u);
  const areaLbl = areaUnitLabel(u);

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
              Input all your roof measurements in one place. Apply pitch, calculate lengths, and get a complete material takeoff for pricing. No signup required.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-2 md:px-6 py-6 md:py-10 pb-20 md:pb-10">
          {!measureMode && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">How do you want to enter your measurements?</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the method that matches your measurements.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <button onClick={() => setMeasureMode('actual')}
                  className="group rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] min-h-[180px] flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <InfoIcon text="Use this if you've already measured the roof (e.g. with a tape, laser, or from software) and have the real final lengths and areas. The system just records what you enter and adds waste." />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">I have actual measurements</h3>
                  <p className="mt-1 text-sm text-slate-500 flex-1">You already have final roof dimensions (real lengths, real areas). Just type them in - no pitch calculation needed.</p>
                </button>
                <button onClick={() => setMeasureMode('plan')}
                  className="group rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] min-h-[180px] flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <InfoIcon text="Use this if you're measuring off a plan view (top-down drawing or PDF). You enter the plan lengths and the roof pitch, and the system calculates the real sloped lengths and areas for you." />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">I'm measuring from a plan</h3>
                  <p className="mt-1 text-sm text-slate-500 flex-1">You have a top-down roof plan. Enter plan dimensions and the roof pitch - we'll calculate the real sloped lengths and areas automatically.</p>
                </button>
              </div>
            </div>
          )}

          {measureMode && !unitSystem && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-4 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{measureMode === 'actual' ? 'Actual Measurements Mode' : 'Plan + Pitch Calculation Mode'}</span>
                </div>
                <button onClick={() => setMeasureMode(null)} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">Change mode</button>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">What measurement units do you use?</h2>
                <p className="mt-1 text-sm text-slate-500">Pick your preferred units. You'll use these for the entire takeoff.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <button onClick={() => { setUnitSystem('metric'); setExpandedSection('roof_area'); }}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-center transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] flex flex-col items-center">
                  <span className="text-2xl font-bold text-slate-900">m / m&sup2;</span>
                  <span className="mt-1 text-sm text-slate-500">Metric</span>
                  <span className="mt-1 text-xs text-slate-400">Metres &amp; square metres</span>
                </button>
                <button onClick={() => { setUnitSystem('imperial'); setExpandedSection('roof_area'); }}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-center transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] flex flex-col items-center">
                  <span className="text-2xl font-bold text-slate-900">ft / sq ft</span>
                  <span className="mt-1 text-sm text-slate-500">Imperial</span>
                  <span className="mt-1 text-xs text-slate-400">Feet &amp; square feet</span>
                </button>
                <button onClick={() => { setUnitSystem('squares'); setExpandedSection('roof_area'); }}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-center transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] flex flex-col items-center">
                  <span className="text-2xl font-bold text-slate-900">squares</span>
                  <span className="mt-1 text-sm text-slate-500">Roofing Squares</span>
                  <span className="mt-1 text-xs text-slate-400">1 square = 100 sq ft</span>
                </button>
              </div>
            </div>
          )}

          {measureMode && unitSystem && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-4 mb-5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{measureMode === 'actual' ? 'Actual Measurements' : 'Plan + Pitch Calculation'}</span>
                  </div>
                  <div className="w-px h-4 bg-slate-200" />
                  <span className="text-sm font-medium text-slate-500">{u === 'metric' ? 'Metric (m / m&sup2;)' : u === 'imperial' ? 'Imperial (ft / sq ft)' : 'Roofing Squares'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setUnitSystem(null)} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">Change units</button>
                  <button onClick={() => { setMeasureMode(null); setUnitSystem(null); }} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">Start over</button>
                </div>
              </div>

              {measureMode === 'plan' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">Roof Pitch</span>
                      <InfoIcon text="Roof pitch is the angle of the roof slope. E.g. 25 degrees is a common UK roof pitch. We use this to calculate the real sloped lengths from your plan measurements." />
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
                      <button onClick={() => setPitchMode('degrees')} className={`rounded-full px-3 py-1 text-xs font-medium transition ${pitchMode === 'degrees' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Degrees</button>
                      <button onClick={() => setPitchMode('ratio')} className={`rounded-full px-3 py-1 text-xs font-medium transition ${pitchMode === 'ratio' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Ratio</button>
                    </div>
                    {pitchMode === 'degrees' ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <input type="number" value={masterPitch} onChange={(e) => updatePitchDegrees(e.target.value)} min={0} max={89} step={0.5} inputMode="decimal" className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-orange-500 focus:outline-none" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">deg</span>
                        </div>
                        <span className="text-xs text-slate-400">= {masterRatio}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="text" value={masterRatio} onChange={(e) => updatePitchRatio(e.target.value)} placeholder="5:12" className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-orange-500 focus:outline-none" />
                        <span className="text-xs text-slate-400">= {masterPitch} deg</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {COMPONENT_ORDER.map(kind => {
                  const section = sections[kind];
                  const isExpanded = expandedSection === kind;
                  const total = totals[kind];
                  const hasEntries = section.entries.length > 0;
                  const displayUnit = kind === 'roof_area' ? areaLbl : lenLbl;
                  return (
                    <div key={kind} className={`rounded-xl border bg-white transition ${isExpanded ? 'border-slate-300 shadow-sm' : 'border-slate-200'}`}>
                      <button onClick={() => setExpandedSection(isExpanded ? null : kind)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-orange-50/40 transition rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <ComponentSymbol kind={kind} className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-900">{componentLabel(kind)}</span>
                          {hasEntries && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{section.entries.length} {section.entries.length === 1 ? 'entry' : 'entries'}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          {hasEntries && (
                            <div className="text-right">
                              <span className="text-sm font-semibold text-slate-900">{total.rawTotal.toFixed(2)} {displayUnit}</span>
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
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600 flex items-center gap-1">Waste<InfoIcon text="Waste adds extra material to account for cuts, breaks, and overlaps. E.g. 10% waste on 100m means you'll order 110m." /></label>
                            <div className="relative">
                              <input type="number" value={section.wastePercent} onChange={(e) => updateWaste(kind, parseFloat(e.target.value) || 0)} min={0} max={100} step={1} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm text-center focus:border-orange-500 focus:outline-none" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                            </div>
                          </div>

                          {hasEntries && (
                            <div className="space-y-1.5">
                              {section.entries.map((entry, idx) => (
                                <EntryListItem key={entry.id} entry={entry} index={idx} kind={kind} measureMode={measureMode} lenLabel={lenLbl} areaLabel={areaLbl} wastePercent={section.wastePercent} getComponentById={getComponentById} onRemove={() => removeEntry(kind, entry.id)} />
                              ))}
                            </div>
                          )}

                          <AddEntryForm kind={kind} measureMode={measureMode} lenLabel={lenLbl} areaLabel={areaLbl} availableComponents={componentsByKind[kind] || []} componentsLoading={componentsLoading} pitchDegrees={effectivePitch} onAdd={(entry) => addEntry(kind, entry)} />

                          {!hasEntries && <p className="text-xs text-slate-400 text-center py-2">No {componentLabel(kind).toLowerCase()} entries yet. Add your first one above.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasData && (
                <div className="mt-6 rounded-xl bg-slate-900 text-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Summary</h3>
                    <span className="text-xs text-slate-400">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} total</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COMPONENT_ORDER.map(kind => {
                      const t = totals[kind];
                      if (t.count === 0) return null;
                      const du = kind === 'roof_area' ? areaLbl : lenLbl;
                      return (
                        <div key={kind} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                          <div className="flex items-center gap-1.5"><ComponentSymbol kind={kind} className="w-3 h-3 text-slate-400" /><span className="text-xs text-slate-300">{componentLabel(kind)}</span></div>
                          <div className="mt-1 text-sm font-semibold">{t.rawTotal.toFixed(2)} {du}</div>
                          {sections[kind].wastePercent > 0 && <div className="text-xs text-slate-400">w/ waste: {t.withWaste.toFixed(2)} {du}</div>}
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
                  <button onClick={generateResults} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] min-h-[44px]">
                    Generate Takeoff Report
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
              {!hasData && (
                <div className="mt-6 rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
                  <svg className="mx-auto w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
                  <p className="mt-3 text-sm text-slate-500">Start by adding measurements for any roof component above.</p>
                  <p className="mt-1 text-xs text-slate-400">Expand a section and use the add form to begin.</p>
                </div>
              )}
            </>
          )}
        </div>

        {showResults && <ResultsModal sections={sections} totals={totals} getComponentById={getComponentById} grandTotal={grandTotal} unitSystem={u} onClose={() => setShowResults(false)} />}
        <SiteFooter />
      </main>
    </FreeToolsAuthProvider>
  );
}
