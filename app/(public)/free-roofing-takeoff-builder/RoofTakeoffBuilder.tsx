'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { trackEvent } from '@/lib/analytics';
import type { ComponentKind, Entry, ComponentSection, RoofComponentDef, InputMode, PitchScope } from './types';
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

export function RoofTakeoffBuilder() {
  const [sections, setSections] = useState<Record<ComponentKind, ComponentSection>>(makeInitialSections);
  const [masterPitch, setMasterPitch] = useState('25');
  const [pitchScope, setPitchScope] = useState<PitchScope>('master');
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

  const applyMasterPitch = useCallback((pitch: string) => {
    setMasterPitch(pitch);
    if (pitchScope === 'master') {
      const pitchNum = parseFloat(pitch) || 0;
      setSections(prev => {
        const next = { ...prev };
        for (const kind of COMPONENT_ORDER) {
          next[kind] = { ...next[kind], entries: next[kind].entries.map(e => ({ ...e, pitchDegrees: pitchNum })) };
        }
        return next;
      });
    }
  }, [pitchScope]);

  const addEntry = (kind: ComponentKind) => {
    const pitch = pitchScope === 'master' ? (parseFloat(masterPitch) || 25) : 25;
    const firstComp = componentsByKind[kind]?.[0];
    const suggestedWaste = firstComp?.suggested_waste_percent;
    setSections(prev => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        entries: [...prev[kind].entries, { ...makeEntry(pitch), selectedComponentId: firstComp?.id ?? null }],
        wastePercent: suggestedWaste ?? prev[kind].wastePercent,
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
          {/* Pitch Control Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
                </svg>
                <span className="text-sm font-semibold text-slate-700">Pitch Setting</span>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 w-fit">
                {([ { value: 'master', label: 'Master' }, { value: 'per_component', label: 'Per Component' }, { value: 'per_entry', label: 'Per Entry' }] as { value: PitchScope; label: string }[]).map(opt => (
                  <button key={opt.value} onClick={() => setPitchScope(opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${pitchScope === opt.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {pitchScope === 'master' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Master Pitch:</label>
                  <div className="relative">
                    <input type="number" value={masterPitch} onChange={(e) => applyMasterPitch(e.target.value)} min={0} max={89} step={0.5}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-orange-500 focus:outline-none" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">°</span>
                  </div>
                </div>
              )}
            </div>
            {pitchScope !== 'master' && (
              <p className="mt-2 text-xs text-slate-400">
                {pitchScope === 'per_component' ? 'Set pitch per component section. All entries in that section use the same pitch.' : 'Set pitch individually on each entry.'}
              </p>
            )}
          </div>

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
                      {pitchScope === 'per_component' && def.pitchType !== 'none' && (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                          <label className="text-xs font-medium text-slate-600">Section Pitch:</label>
                          <div className="relative">
                            <input type="number" value={section.entries[0]?.pitchDegrees ?? 25}
                              onChange={(e) => { const pitch = parseFloat(e.target.value) || 0; setSections(prev => ({ ...prev, [kind]: { ...prev[kind], entries: prev[kind].entries.map(en => ({ ...en, pitchDegrees: pitch })) } })); }}
                              min={0} max={89} step={0.5} disabled={!hasEntries}
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-center focus:border-orange-500 focus:outline-none disabled:opacity-50" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">°</span>
                          </div>
                          <span className="text-xs text-slate-400">Applies to all {def.label} entries</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-600">Waste:</label>
                        <div className="relative">
                          <input type="number" value={section.wastePercent} onChange={(e) => updateWaste(kind, parseFloat(e.target.value) || 0)}
                            min={0} max={100} step={1} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm text-center focus:border-orange-500 focus:outline-none" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                      </div>

                      {section.entries.map((entry, idx) => (
                        <EntryRow key={entry.id} entry={entry} index={idx} kind={kind} pitchScope={pitchScope}
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
              <p className="mt-1 text-xs text-slate-400">Choose a pitch mode, then expand a section and click &quot;Add Entry&quot;.</p>
            </div>
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

// ─── Entry Row Component ─────────────────────────────

interface EntryRowProps {
  entry: Entry;
  index: number;
  kind: ComponentKind;
  pitchScope: PitchScope;
  availableComponents: RoofComponentDef[];
  componentsLoading: boolean;
  onUpdate: (updates: Partial<Entry>) => void;
  onRemove: () => void;
  getComponentById: (id: string | null) => RoofComponentDef | null;
}

function EntryRow({ entry, index, kind, pitchScope, availableComponents, onUpdate, onRemove, getComponentById }: EntryRowProps) {
  const def = COMPONENT_DEFS[kind];
  const isRoofArea = kind === 'roof_area';
  const showPitch = def.pitchType !== 'none' && entry.inputMode === 'pitch_calculated';
  const selectedComp = getComponentById(entry.selectedComponentId);
  const compCost = selectedComp ? computeMaterialCost(entry.computedValue, selectedComp) : { cost: 0, packs: 0 };
  const labourCost = selectedComp ? computeLabourCost(entry.computedValue, selectedComp) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Entry {index + 1}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5">
            <button onClick={() => onUpdate({ inputMode: 'pitch_calculated' })}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${entry.inputMode === 'pitch_calculated' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
              Pitch Calc
            </button>
            <button onClick={() => onUpdate({ inputMode: 'actual' })}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${entry.inputMode === 'actual' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
              Actual
            </button>
          </div>
          <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition p-1" aria-label="Remove entry">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {isRoofArea ? (
          entry.inputMode === 'pitch_calculated' ? (
            <>
              <NumField label="Plan Width (m)" value={entry.planWidth} onChange={(v) => onUpdate({ planWidth: v })} />
              <NumField label="Plan Length (m)" value={entry.planLengthVal} onChange={(v) => onUpdate({ planLengthVal: v })} />
            </>
          ) : (
            <div className="col-span-2">
              <NumField label="Actual Area (m²)" value={entry.actualValue} onChange={(v) => onUpdate({ actualValue: v })} />
            </div>
          )
        ) : (
          entry.inputMode === 'pitch_calculated' ? (
            <div className="col-span-2">
              <NumField label="Plan Length (m)" value={entry.planLength} onChange={(v) => onUpdate({ planLength: v })} />
            </div>
          ) : (
            <div className="col-span-2">
              <NumField label={`Actual Length (${def.unit})`} value={entry.actualValue} onChange={(v) => onUpdate({ actualValue: v })} />
            </div>
          )
        )}
        {showPitch && pitchScope === 'per_entry' && (
          <NumField label="Pitch (°)" value={entry.pitchDegrees} onChange={(v) => onUpdate({ pitchDegrees: v })} step={0.5} min={0} max={89} />
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
