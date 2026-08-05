'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { trackEvent } from '@/lib/analytics';
import type { Entry, ComponentSection, RoofComponentDef, CustomComponentDef } from './types';
import {
  COMPONENT_DEFS,
  BUILT_IN_ORDER,
  areaValueForUnit,
  computeEntry,
  makeInitialSections,
  makeCustomSection,
  registerCustomKind,
  isCustomFixed,
} from './calc';
import { calculateTakeoffSections } from './engine';
import {
  normalizePublicRoofTakeoff,
  validatePublicInput,
  type PublicRoofTakeoffInput,
} from './public-contract';
import { EntryListItem, AddEntryForm } from './EntryComponents';
import {
  InfoIcon,
  ComponentSymbol,
  componentLabel,
  componentDescription,
  unitLabel,
  areaUnitLabel,
  ratioToDegrees,
  degreesToRatio,
} from './helpers';
import dynamic from 'next/dynamic';

// Lazy-load modals and conditional UI to reduce initial bundle
const ResultsModal = dynamic(() => import('./ResultsModal').then(m => ({ default: m.ResultsModal })));
const ComponentGuideBox = dynamic(() => import('./ComponentGuideBox').then(m => ({ default: m.ComponentGuideBox })));
const CustomComponentCreator = dynamic(() => import('./EntryComponents').then(m => ({ default: m.CustomComponentCreator })));

type MeasureMode = 'actual' | 'plan';
type UnitSystem = 'metric' | 'imperial' | 'squares';
type ExperienceLevel = 'guided' | 'fast';

interface PersistedTakeoffState {
  measureMode?: MeasureMode;
  unitSystem?: UnitSystem;
  experience?: ExperienceLevel;
  masterPitch?: string;
  masterRatio?: string;
  sections?: Record<string, ComponentSection>;
  customSections?: Record<string, ComponentSection>;
}

const SESSION_KEY = 'qcp:frtb:session';

interface SupplierInfo {
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  country: string | null;
  currency: string;
  unitSystem: 'metric' | 'imperial' | 'squares';
  collectionId: string;
  collectionName: string;
  branchCity: string | null;
  branchRegion: string | null;
  enquiriesEnabled: boolean;
  enquiryEmail: string | null;
  description: string | null;
  roofingTypes: string[];
  productCategories: string[];
  brands: string[];
  nationalCoverage: boolean;
  deliveryCoverage: string;
}

interface RoofTakeoffBuilderProps {
  initialInput?: PublicRoofTakeoffInput;
  embed?: boolean; // When true, skip header/footer/H1 (for embedding in other pages)
  initialSupplierSlug?: string; // Pre-select supplier (from URL route)
}

export function RoofTakeoffBuilder({ initialInput, embed = false, initialSupplierSlug }: RoofTakeoffBuilderProps) {
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierInfo | null>(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierLocationFilter, setSupplierLocationFilter] = useState('');
  const [supplierRoofTypeFilter, setSupplierRoofTypeFilter] = useState('');
  const [supplierLibraries, setSupplierLibraries] = useState<SupplierInfo[]>([]);
  const [supplierLibrariesLoading, setSupplierLibrariesLoading] = useState(false);
  const [supplierSkip, setSupplierSkip] = useState(false);
  const [supplierAutoLoadDone, setSupplierAutoLoadDone] = useState(false);

  // History management: simple beforeunload warning when user has data.
  // No pushState/popstate tricks - on refresh or back navigation, the wizard resets cleanly.
  // This is intentional: sessionStorage restore was causing blank pages and history traps.
  // (beforeunload listener is added after state declarations below)
  const [experience, setExperience] = useState<ExperienceLevel>('fast');
  const [includeLabour, setIncludeLabour] = useState(true);
  const [pitchMode, setPitchMode] = useState<'degrees' | 'ratio'>('degrees');
  const [sections, setSections] = useState<Record<string, ComponentSection>>(makeInitialSections);
  const [customSections, setCustomSections] = useState<Record<string, ComponentSection>>({});
  const [masterPitch, setMasterPitch] = useState('25');
  const [masterRatio, setMasterRatio] = useState('5:12');
  const [expandedSection, setExpandedSection] = useState<string | null>('roof_area');
  const [showResults, setShowResults] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [components, setComponents] = useState<RoofComponentDef[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(true);

  // beforeunload warning: if user has entered data, warn before refresh/close.
  // Also intercept browser back button and refresh with a branded QuoteCore+ modal.
  useEffect(() => {
    if (!measureMode) return;

    // Push a dummy state so we can detect back navigation
    window.history.pushState({ wizard: true }, '', window.location.href);

    const hasEnteredData = () => Object.values(sections).some(s => s.entries.length > 0);

    const handlePopState = (e: PopStateEvent) => {
      if (hasEnteredData()) {
        // Re-push state so we stay on the page, show our modal instead
        window.history.pushState({ wizard: true }, '', window.location.href);
        setShowLeaveWarning(true);
      } else {
        // No data entered, let them leave freely
        setMeasureMode(null);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasEnteredData()) {
        // Browsers force a native dialog here - we can't suppress it entirely.
        // But we also intercept F5/Ctrl+R below to show our branded modal first.
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // Intercept F5 and Ctrl+R to show our branded modal instead of native refresh
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasEnteredData()) return;
      const isRefresh = (e.key === 'F5') || ((e.ctrlKey || e.metaKey) && e.key === 'r');
      if (isRefresh) {
        e.preventDefault();
        setShowLeaveWarning(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [measureMode, sections]);

  // On mount: if URL params have a complete takeoff input (shared link), load it directly.
  // Otherwise, start fresh - no sessionStorage restore. On refresh, the user starts over.
  // This is intentional: sessionStorage restore was causing blank-page bugs on refresh.
  useEffect(() => {
    if (initialInput && validatePublicInput(initialInput).length === 0) {
      const normalized = normalizePublicRoofTakeoff(initialInput);
      setMeasureMode(normalized.mode);
      setUnitSystem(normalized.units);
      setMasterPitch(String(normalized.pitchDegrees));
      setMasterRatio(degreesToRatio(normalized.pitchDegrees, normalized.units));
      setSections(normalized.sections);
      setCustomSections({});
      setExpandedSection('roof_area');
    }
    // Clean up any stale sessionStorage from previous versions
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }, [initialInput]);

  // Save to sessionStorage on change (for potential future use, but we don't restore from it)
  useEffect(() => {
    if (measureMode && unitSystem) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          measureMode, unitSystem, experience, masterPitch, masterRatio, sections, customSections,
        }));
      } catch {}
    }
  }, [measureMode, unitSystem, experience, masterPitch, masterRatio, sections, customSections]);

  // Load supplier libraries list (for selection UI)
  useEffect(() => {
    if (!initialSupplierSlug) {
      setSupplierLibrariesLoading(true);
      fetch('/api/free-tools/supplier-libraries')
        .then(r => r.json())
        .then(data => {
          if (data.libraries) {
            // On .co.nz, sort NZ suppliers first
            const isNz = window.location.hostname.endsWith('.co.nz');
            const sorted = isNz
              ? [...data.libraries].sort((a: any, b: any) => {
                  const aNz = a.country === 'NZ' || a.country === 'New Zealand';
                  const bNz = b.country === 'NZ' || b.country === 'New Zealand';
                  if (aNz && !bNz) return -1;
                  if (!aNz && bNz) return 1;
                  return 0;
                })
              : data.libraries;
            setSupplierLibraries(sorted);
          }
        })
        .catch(() => {})
        .finally(() => setSupplierLibrariesLoading(false));
    }
  }, [initialSupplierSlug]);

  // Auto-load supplier if slug provided via URL
  useEffect(() => {
    if (initialSupplierSlug) {
      setSupplierLibrariesLoading(true);
      fetch(`/api/free-tools/supplier-library/${initialSupplierSlug}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.library) {
            const lib = data.library;
            setSelectedSupplier({
              supplierId: lib.supplierId,
              supplierName: lib.supplierName,
              supplierSlug: lib.supplierSlug,
              country: lib.supplierCountry,
              currency: lib.currency,
              collectionId: lib.collectionId,
              collectionName: lib.collectionName,
              branchCity: lib.branchCity ?? null,
              branchRegion: lib.branchRegion ?? null,
              enquiriesEnabled: lib.enquiriesEnabled ?? false,
              enquiryEmail: lib.enquiryEmail ?? null,
              unitSystem: lib.unitSystem || 'metric',
              description: lib.description ?? null,
              roofingTypes: lib.roofingTypes ?? [],
              productCategories: lib.productCategories ?? [],
              brands: lib.brands ?? [],
              nationalCoverage: lib.nationalCoverage ?? false,
              deliveryCoverage: lib.deliveryCoverage ?? '',
            });
            // Auto-set unit from supplier's collection
            setUnitSystem(lib.unitSystem || 'metric');
          }
        })
        .catch(() => {})
        .finally(() => {
          setSupplierLibrariesLoading(false);
          setSupplierAutoLoadDone(true);
        });
    }
  }, [initialSupplierSlug]);

  // Load components - supplier library if selected, otherwise generic
  // When initialSupplierSlug is provided, wait for supplier auto-load to complete
  // before falling back to generic components (prevents race condition where
  // generic components load first and get overwritten or overwrite supplier data)
  useEffect(() => {
    if (selectedSupplier) {
      fetch(`/api/free-tools/supplier-library/${selectedSupplier.supplierSlug}`)
        .then(r => r.json())
        .then(data => {
          if (data?.library?.components) {
            // Map published takeoff components to RoofComponentDef format
            const mapped: RoofComponentDef[] = data.library.components.map((c: any) => ({
              id: c.id,
              component_kind: c.component_kind,
              name: c.name,
              description: c.description,
              unit: c.unit,
              price_per_unit: c.price_per_unit,
              pricing_strategy: c.pricing_strategy,
              pack_size: c.pack_size,
              pack_price: c.pack_price,
              labour_rate: c.labour_rate,
              labour_unit: c.labour_unit,
              suggested_waste_percent: c.suggested_waste_percent,
              pitch_type: c.pitch_type,
              is_active: c.is_active,
              sort_order: c.sort_order,
            }));
            setComponents(mapped);
          }
        })
        .catch(() => {})
        .finally(() => setComponentsLoading(false));
    } else if (!initialSupplierSlug || supplierAutoLoadDone) {
      // Only fetch generic components if:
      // - No supplier slug was provided via URL (user is on generic builder), OR
      // - Supplier slug was provided but auto-load already completed without finding a supplier
      fetch('/api/free-tools/roof-components')
        .then(r => r.json())
        .then(data => { if (data.components) setComponents(data.components); })
        .catch(() => {})
        .finally(() => setComponentsLoading(false));
    }
    // If initialSupplierSlug is provided and auto-load hasn't completed yet, do nothing (wait)
  }, [selectedSupplier, initialSupplierSlug, supplierAutoLoadDone]);

  // Group components by their measurement characteristics (pitch_type + unit type)
  // so all eligible components appear in each section's dropdown.
  // Components whose native component_kind matches the section are sorted first.
  const componentsByKind = useMemo(() => {
    const map: Record<string, RoofComponentDef[]> = {};
    const isAreaUnit = (unit: string) => /^m[²2]/i.test(unit);
    for (const kind of BUILT_IN_ORDER) {
      const def = COMPONENT_DEFS[kind];
      if (!def) { map[kind] = []; continue; }
      const sectionIsArea = isAreaUnit(def.unit);
      const sectionPitchType = def.pitchType;
      // Match components by pitch_type and unit type (area vs linear)
      const matches = components.filter(c => {
        const cIsArea = isAreaUnit(c.unit);
        return c.pitch_type === sectionPitchType && cIsArea === sectionIsArea;
      });
      // Sort: native component_kind first, then by sort_order, then name
      matches.sort((a, b) => {
        const aNative = a.component_kind === kind ? 0 : 1;
        const bNative = b.component_kind === kind ? 0 : 1;
        if (aNative !== bNative) return aNative - bNative;
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      });
      map[kind] = matches;
    }
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
  const isGuided = experience === 'guided';

  useEffect(() => {
    if (measureMode !== 'plan') return;

    const recalculate = (current: Record<string, ComponentSection>) => {
      let changed = false;
      const next: Record<string, ComponentSection> = {};

      for (const [key, section] of Object.entries(current)) {
        const pitchType = section.customDef?.pitchType ?? COMPONENT_DEFS[key]?.pitchType ?? 'none';
        const isArea = key === 'roof_area' || key === 'underlay' || key === 'fixings' || section.customDef?.measurementType === 'area';
        const entries = section.entries.map(entry => {
          if (entry.inputMode !== 'pitch_calculated') return entry;
          const updated = { ...entry, pitchDegrees: effectivePitch };
          let computedValue = computeEntry(updated, key, pitchType);
          if (isArea) computedValue = areaValueForUnit(computedValue, unitSystem || 'metric', !entry.isTotalInput);
          changed = changed || computedValue !== entry.computedValue || entry.pitchDegrees !== effectivePitch;
          return { ...updated, computedValue };
        });
        next[key] = { ...section, entries };
      }

      return changed ? next : current;
    };

    const timeoutId = window.setTimeout(() => {
      setSections(recalculate);
      setCustomSections(recalculate);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [effectivePitch, measureMode, unitSystem]);

  const allSections = useMemo(() => ({ ...sections, ...customSections }), [sections, customSections]);
  const allKeys = useMemo(() => [...BUILT_IN_ORDER, ...Object.keys(customSections)], [customSections]);

  const addEntry = (key: string, entry: Entry) => {
    const setter = key.startsWith('custom-') ? setCustomSections : setSections;
    setter(prev => ({ ...prev, [key]: { ...prev[key], entries: [...prev[key].entries, entry] } }));
  };

  const removeEntry = (key: string, entryId: string) => {
    const setter = key.startsWith('custom-') ? setCustomSections : setSections;
    setter(prev => ({ ...prev, [key]: { ...prev[key], entries: prev[key].entries.filter(e => e.id !== entryId) } }));
  };

  const updateWaste = (key: string, waste: number) => {
    const setter = key.startsWith('custom-') ? setCustomSections : setSections;
    setter(prev => ({ ...prev, [key]: { ...prev[key], wastePercent: waste } }));
  };

  const addCustomComponent = (def: CustomComponentDef) => {
    const key = `custom-${def.id}`;
    const section = makeCustomSection(def);
    setCustomSections(prev => ({ ...prev, [key]: section }));
    setExpandedSection(key);
  };

  const removeCustomComponent = (key: string) => {
    setCustomSections(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const calculation = useMemo(
    () => calculateTakeoffSections(allSections, allKeys, getComponentById, includeLabour),
    [allSections, allKeys, getComponentById, includeLabour],
  );
  const totals = calculation.sections;

  const totalEntries = calculation.totalEntries;
  const hasData = totalEntries > 0;
  const grandTotal = calculation.grandTotal;

  // Generate result URL via API (Node crypto not available in browser)
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasData) { setResultUrl(null); return; }
    const controller = new AbortController();
    fetch('/api/free-tools/generate-result-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: measureMode ?? 'actual',
        units: unitSystem || 'metric',
        pitchDegrees: parseFloat(masterPitch) || 25,
        area: totals['roof_area']?.rawTotal || undefined,
        ridge: allSections['ridge']?.entries.map((e: any) => e.computedValue).filter(Boolean) || undefined,
        hips: allSections['hip']?.entries.map((e: any) => e.computedValue).filter(Boolean) || undefined,
        valleys: allSections['valley']?.entries.map((e: any) => e.computedValue).filter(Boolean) || undefined,
        barges: allSections['barge']?.entries.map((e: any) => e.computedValue).filter(Boolean) || undefined,
        spouting: allSections['spouting']?.entries.map((e: any) => e.computedValue).filter(Boolean) || undefined,
        supplier: selectedSupplier?.supplierSlug || undefined,
        country: selectedSupplier?.country || undefined,
        includeLabour,
      }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.resultUrl) {
          setResultUrl(data.resultUrl);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('[resultUrl] Failed:', err);
      });
    return () => controller.abort();
  }, [hasData, totals, allSections, measureMode, unitSystem, masterPitch, selectedSupplier, includeLabour]);
  const clearTakeoff = () => {
    setSections(makeInitialSections());
    setCustomSections({});
    setMasterPitch('25');
    setMasterRatio('5:12');
    setExpandedSection('roof_area');
    setShowResults(false);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const changeUnits = () => {
    if (hasData && !window.confirm('Changing units clears the current takeoff. Continue?')) return;
    if (hasData) clearTakeoff();
    setUnitSystem(null);
  };

  const startOver = () => {
    if (hasData && !window.confirm('Start over and clear the current takeoff?')) return;
    clearTakeoff();
    setMeasureMode(null);
    setUnitSystem(null);
    setSelectedSupplier(null);
    setSupplierSkip(false);
  };
  // Currency symbol based on supplier currency or default
  const currencySymbol = selectedSupplier?.currency === 'NZD' ? 'NZ$' :
    selectedSupplier?.currency === 'USD' ? '$' :
    selectedSupplier?.currency === 'AUD' ? 'A$' :
    selectedSupplier?.currency === 'GBP' ? '\u00a3' : '$';
  const cur = currencySymbol;

  const u = unitSystem || 'metric';
  const lenLbl = unitLabel(u);
  const areaLbl = areaUnitLabel(u);

  const renderSection = (key: string) => {
    const section = allSections[key];
    if (!section) return null;
    const isCustom = key.startsWith('custom-');
    const label = componentLabel(key, section.customDef);
    const desc = componentDescription(key, section.customDef);
    const isRoofArea = key === 'roof_area' || key === 'underlay' || key === 'fixings';
    const isFixed = isCustomFixed(key);
    const isExpanded = expandedSection === key;
    const total = totals[key] ?? { rawTotal: 0, withWaste: 0, count: 0, totalCost: 0 };
    const hasEntries = section.entries.length > 0;
    const displayUnit = isFixed ? 'pcs' : (isRoofArea || (isCustom && section.customDef?.measurementType === 'area') ? areaLbl : lenLbl);
    const availableComponents = isCustom ? components : (componentsByKind[key] || []);
    const sectionHasLabour = availableComponents.some(c => c.labour_rate > 0);

    return (
      <div key={key} className={`rounded-xl border bg-white transition ${isExpanded ? 'border-slate-300 shadow-sm' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between px-2 md:px-4 py-3">
          <button onClick={() => setExpandedSection(isExpanded ? null : key)} className="flex items-center gap-2.5 cursor-pointer hover:text-[#BD4A1A] transition flex-1 min-w-0">
            <ComponentSymbol kind={key} customDef={section.customDef} className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-900 truncate">{label}</span>
            {sectionHasLabour && (
              <span className="text-[10px] italic text-slate-400 flex-shrink-0">{includeLabour ? '(materials + labour)' : '(materials only)'}</span>
            )}
            {hasEntries && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 flex-shrink-0">{section.entries.length} {section.entries.length === 1 ? 'entry' : 'entries'}</span>}
            {isGuided && !hasEntries && <span className="text-xs text-slate-400 truncate hidden md:inline">{desc}</span>}
          </button>
          <div className="mr-2 flex-shrink-0"><InfoIcon text={desc} /></div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {hasEntries && (
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-900">{total.rawTotal.toFixed(2)} {displayUnit}</span>
                {total.totalCost > 0 && <span className="ml-2 text-xs text-[#BD4A1A] font-medium">{cur}{total.totalCost.toFixed(2)}</span>}
                {section.wastePercent > 0 && <span className="ml-2 text-xs text-slate-400">+{section.wastePercent}%</span>}
              </div>
            )}
            {isCustom && (
              <button onClick={() => removeCustomComponent(key)} className="text-slate-300 hover:text-red-500 transition p-1" aria-label="Remove custom component">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            <button onClick={() => setExpandedSection(isExpanded ? null : key)}>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className="border-t border-slate-100 p-2 md:p-4 space-y-3">
            {isGuided && <ComponentGuideBox componentKey={key} />}
            <div className="flex items-center gap-2">
              <label htmlFor={`${key}-waste`} className="text-xs font-medium text-slate-600">Waste</label>
              <InfoIcon text="Waste percentage is added to the raw quantity at the end. The raw total shown does NOT include waste - the final total with waste is shown in the results." />
              <div className="relative">
                <input id={`${key}-waste`} name={`${key}WastePercent`} type="number" value={section.wastePercent} onChange={(e) => updateWaste(key, parseFloat(e.target.value) || 0)} min={0} max={100} step={1} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-base md:text-sm text-center focus:border-orange-500 focus:outline-none" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
            </div>

            <AddEntryForm kind={key} customDef={section.customDef} measureMode={measureMode!} lenLabel={lenLbl} areaLabel={areaLbl} availableComponents={availableComponents} componentsLoading={componentsLoading} pitchDegrees={effectivePitch} unitSystem={u} roofAreaTotal={isRoofArea && key !== 'roof_area' ? roofAreaTotal : null} isFixed={isFixed} onAdd={(entry) => addEntry(key, entry)} />

            {hasEntries && (
              <div className="space-y-1.5">
                {section.entries.map((entry, idx) => (
                  <EntryListItem key={entry.id} entry={entry} index={idx} kind={key} customDef={section.customDef} measureMode={measureMode!} lenLabel={lenLbl} areaLabel={areaLbl} wastePercent={section.wastePercent} isFixed={isFixed} getComponentById={getComponentById} onRemove={() => removeEntry(key, entry.id)} />
                ))}
              </div>
            )}

            {!hasEntries && <p className="text-xs text-slate-400 text-center py-2">No {label.toLowerCase()} entries yet. Add your first one above.</p>}
          </div>
        )}
      </div>
    );
  };

  // Compute the pre-pitch roof area for "Use Roof Area" button on underlay/fixings
  // In plan mode, rawTotal includes pitch. We want the original plan area so pitch
  // gets applied once by the engine when underlay/fixings compute their values.
  const roofAreaPrePitch = useMemo(() => {
    const section = allSections['roof_area'];
    if (!section || section.entries.length === 0) return null;
    let total = 0;
    for (const entry of section.entries) {
      const qty = entry.quantity ?? 1;
      if (entry.inputMode === 'actual') {
        // Actual mode: no pitch applied, value is already final
        total += (entry.actualValue ?? 0) * qty;
      } else if (entry.isTotalInput) {
        // Total input in plan mode: actualValue is the plan area, pitch applied by computeEntry
        total += (entry.actualValue ?? 0) * qty;
      } else {
        // Dimensions in plan mode: planWidth * planLength is the pre-pitch area
        total += ((entry.planWidth ?? 0) * (entry.planLengthVal ?? 0)) * qty;
      }
    }
    return total > 0 ? total : null;
  }, [allSections]);

  const roofAreaTotal = roofAreaPrePitch;

  return (
    <FreeToolsAuthProvider>
      <main className={embed ? "min-h-screen bg-white" : "min-h-screen bg-white"}>
        {!embed && <BlogHeader />}
        {!embed && (
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
        )}

        <div className="mx-auto max-w-5xl px-2 md:px-6 py-6 md:py-10 pb-24 md:pb-10">
          {/* Step 1: Measurement Mode */}
          {!measureMode && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">How do you want to enter your measurements?</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the method that matches your measurements.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="relative">
                  <button onClick={() => setMeasureMode('actual')}
                    className="group w-full rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] min-h-[180px] flex flex-col">
                  <div className="flex items-start mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">I have actual measurements</h3>
                  <p className="mt-1 text-sm text-slate-500 flex-1">You already have final roof dimensions. Just type them in - no pitch calculation needed.</p>
                  </button>
                  <div className="absolute right-6 top-6"><InfoIcon text="Use this if you've already measured the roof and have the real final lengths and areas. No pitch calculation needed." /></div>
                </div>
                <div className="relative">
                  <button onClick={() => setMeasureMode('plan')}
                    className="group w-full rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] min-h-[180px] flex flex-col">
                  <div className="flex items-start mb-3">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">I&apos;m measuring from a plan</h3>
                  <p className="mt-1 text-sm text-slate-500 flex-1">You have a top-down roof plan. Enter plan dimensions and the roof pitch - we&apos;ll calculate the real sloped lengths and areas.</p>
                  </button>
                  <div className="absolute right-6 top-6"><InfoIcon text="Use this if you're measuring off a plan view. Enter plan lengths and the roof pitch - we'll calculate the real sloped lengths automatically." /></div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Supplier Selection */}
          {measureMode && !selectedSupplier && !supplierSkip && !unitSystem && (
            <div className="space-y-4">
              {/* Breadcrumb */}
              <button onClick={() => setMeasureMode(null)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#BD4A1A] transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back to measurement mode
              </button>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-4 mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{measureMode === 'actual' ? 'Actual Measurements Mode' : 'Plan + Pitch Calculation Mode'}</span>
                <button onClick={() => setMeasureMode(null)} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">Change mode</button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-bold text-white">2</span>
                <span className="text-xs font-medium text-slate-400">Step 2 - select a supplier</span>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900">Select a Supplier</h2>
                <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                  Pick a supplier to use their real component pricing, or select QuoteCore+ to continue with test prices. You can adjust any cost later.
                </p>
              </div>

              {/* Search filters */}
              <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    placeholder="Search supplier or product..."
                    className="w-full rounded-full border border-slate-300 px-4 py-2 pl-9 text-sm focus:border-orange-500 focus:outline-none"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={supplierLocationFilter}
                  onChange={(e) => setSupplierLocationFilter(e.target.value)}
                  placeholder="Location (city, region, country)..."
                  className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <select
                  value={supplierRoofTypeFilter}
                  onChange={(e) => setSupplierRoofTypeFilter(e.target.value)}
                  className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none bg-white"
                >
                  <option value="">All roof types</option>
                  <option value="metal">Metal / Corrugated</option>
                  <option value="tile">Tile</option>
                  <option value="membrane">Membrane</option>
                  <option value="shingle">Shingle</option>
                  <option value="asphalt">Asphalt</option>
                  <option value="concrete">Concrete</option>
                  <option value="steel">Steel</option>
                </select>
              </div>

              {/* Supplier list */}
              <div className="space-y-2 mt-4">
                {/* QuoteCore+ virtual supplier - always at top, ignores filters */}
                <button
                  onClick={() => setSupplierSkip(true)}
                  className="w-full rounded-xl border-2 border-[#FF6B35] bg-orange-50/30 p-4 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_12px_rgba(255,107,53,0.15)] hover:bg-orange-50/50 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#BD4A1A] transition">QuoteCore+</h3>
                        <span className="rounded-full bg-[#FF6B35] px-2 py-0.5 text-xs font-medium text-white">Default</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Test pricing only - use this to continue, or pick a real supplier below</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">All countries</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">USD</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-[#FF6B35] group-hover:text-[#BD4A1A] transition flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>

                {supplierLibrariesLoading && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-[#FF6B35]" />
                    <p className="mt-2 text-xs text-slate-400">Loading suppliers...</p>
                  </div>
                )}
                {!supplierLibrariesLoading && supplierLibraries.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
                    <p className="text-sm text-slate-500">No external suppliers found. Use QuoteCore+ above to get started.</p>
                  </div>
                )}
                {!supplierLibrariesLoading && supplierLibraries
                  .filter((lib) => {
                    // Text search: name, collection, products, brands
                    if (supplierSearchQuery) {
                      const q = supplierSearchQuery.toLowerCase();
                      const searchText = [lib.supplierName, lib.collectionName, lib.collectionName, ...(lib.productCategories || []), ...(lib.brands || []), ...(lib.roofingTypes || [])]
                        .filter(Boolean).join(' ').toLowerCase();
                      if (!searchText.includes(q)) return false;
                    }
                    // Location filter
                    if (supplierLocationFilter) {
                      const loc = supplierLocationFilter.toLowerCase();
                      const locText = [lib.branchCity, lib.branchRegion, lib.country, lib.deliveryCoverage]
                        .filter(Boolean).join(' ').toLowerCase();
                      if (!locText.includes(loc)) return false;
                    }
                    // Roof type filter
                    if (supplierRoofTypeFilter) {
                      const rt = lib.roofingTypes || [];
                      if (!rt.some(t => t.toLowerCase().includes(supplierRoofTypeFilter))) return false;
                    }
                    return true;
                  })
                  .map((lib) => (
                    <button
                      key={lib.supplierId}
                      onClick={() => {
                        setSelectedSupplier(lib);
                        // Auto-set unit from supplier's collection
                        setUnitSystem(lib.unitSystem || 'metric');
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#BD4A1A] transition truncate">{lib.supplierName}</h3>
                          <p className="mt-0.5 text-xs text-slate-500 truncate">{lib.collectionName}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            {lib.branchCity && <span className="text-xs text-slate-400">{lib.branchCity}{lib.branchRegion ? `, ${lib.branchRegion}` : ''}</span>}
                            {lib.country && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{lib.country}</span>}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{lib.currency}</span>
                            {lib.enquiriesEnabled && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">Enquiries open</span>}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-[#FF6B35] transition flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))
                }
              </div>

              <p className="text-center text-xs text-slate-400 pt-1">
                You can adjust any price after selecting a supplier. No commitment.
              </p>
            </div>
          )}

          {/* Step 3: Units */}
          {measureMode && (selectedSupplier || supplierSkip) && !unitSystem && (
            <div className="space-y-4">
              {/* Breadcrumb */}
              <button onClick={() => { setSelectedSupplier(null); setSupplierSkip(false); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#BD4A1A] transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Back to supplier selection
              </button>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-4 mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{measureMode === 'actual' ? 'Actual Measurements Mode' : 'Plan + Pitch Calculation Mode'}</span>
                <button onClick={() => setMeasureMode(null)} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition rounded-full px-3 py-1 hover:bg-slate-100">Change mode</button>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">What measurement units do you use?</h2>
                <p className="mt-1 text-sm text-slate-500">Pick your preferred units for the entire takeoff.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <button onClick={() => { setUnitSystem('metric'); setExpandedSection('roof_area'); }}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-center transition-all hover:border-[#FF6B35] hover:shadow-[0_0_16px_rgba(255,107,53,0.08)] flex flex-col items-center">
                  <span className="text-2xl font-bold text-slate-900">m / m²</span>
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

          {/* Step 4: Builder */}
          {measureMode && (selectedSupplier || supplierSkip) && unitSystem && (
            <>
              {/* Breadcrumb */}
              <button onClick={() => { setUnitSystem(null); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#BD4A1A] transition mb-3">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                {selectedSupplier ? 'Back to supplier selection' : 'Back to unit selection'}
              </button>
              {/* Compact supplier strip + expandable settings */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 md:p-3 mb-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-500 flex-shrink-0">Pricing from</span>
                    <span className="text-sm font-bold text-[#FF6B35] truncate">{selectedSupplier ? selectedSupplier.supplierName : 'QuoteCore+'}</span>
                    {selectedSupplier && (
                      <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                        {selectedSupplier.currency === 'NZD' ? 'NZ$' : selectedSupplier.currency === 'AUD' ? 'A$' : selectedSupplier.currency === 'GBP' ? '\u00a3' : '$'} {selectedSupplier.currency}
                        <span className="relative inline-flex ml-1 group">
                          <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">This is the supplier's local currency. If you need totals in a different currency, you'll need to convert them yourself.</span>
                        </span>
                      </span>
                    )}
                    {!selectedSupplier && supplierSkip && (
                      <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                        $ USD
                        <span className="relative inline-flex ml-1 group">
                          <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Default currency is USD. These are test prices for planning purposes only.</span>
                        </span>
                      </span>
                    )}
                    <button onClick={() => { setSelectedSupplier(null); setSupplierSkip(false); setUnitSystem(null); }} className="text-xs font-medium text-slate-400 hover:text-[#BD4A1A] transition rounded-full px-2 py-0.5 hover:bg-slate-100 flex-shrink-0">
                      Change supplier
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-0.5 rounded-full border border-[#FF6B35]/30 bg-white p-0.5">
                      <button onClick={() => setIncludeLabour(true)} className={`rounded-full px-2.5 md:px-3 py-1 text-xs font-medium transition ${includeLabour ? 'bg-[#FF6B35] text-white' : 'text-slate-500'}`}>Materials + Labour</button>
                      <button onClick={() => setIncludeLabour(false)} className={`rounded-full px-2.5 md:px-3 py-1 text-xs font-medium transition ${!includeLabour ? 'bg-[#FF6B35] text-white' : 'text-slate-500'}`}>Materials Only</button>
                    </div>
                    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5">
                      <button onClick={() => setExperience('guided')} className={`rounded-full px-2.5 md:px-3 py-1 text-xs font-medium transition ${isGuided ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Guided</button>
                      <button onClick={() => setExperience('fast')} className={`rounded-full px-2.5 md:px-3 py-1 text-xs font-medium transition ${!isGuided ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Fast</button>
                    </div>
                    <button
                      onClick={() => setShowSettings(s => !s)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition rounded-full px-3 py-1 hover:bg-slate-100"
                      aria-expanded={showSettings}
                      aria-controls="builder-settings"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Settings
                      <svg className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
                {showSettings && (
                  <div id="builder-settings" className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-slate-600">Measurement method</span>
                        <p className="text-xs text-slate-400">{measureMode === 'actual' ? 'Actual measurements' : 'Plan + pitch calculation'}</p>
                      </div>
                      <button onClick={() => { if (hasData && !window.confirm('Changing method clears the current takeoff. Continue?')) return; clearTakeoff(); setMeasureMode(null); setUnitSystem(null); }} className="text-xs font-medium text-slate-400 hover:text-[#BD4A1A] transition rounded-full px-2 py-0.5 hover:bg-slate-100">Change method</button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-slate-600">Units</span>
                        <p className="text-xs text-slate-400">{u === 'metric' ? 'Metric (m / m²)' : u === 'imperial' ? 'Imperial (ft / sq ft)' : 'Roofing Squares'}{selectedSupplier && <span className="text-slate-300 ml-1">- locked by supplier</span>}</p>
                      </div>
                      {selectedSupplier ? (
                        <span className="text-xs text-slate-300">Locked</span>
                      ) : (
                        <button onClick={changeUnits} className="text-xs font-medium text-slate-400 hover:text-[#BD4A1A] transition rounded-full px-2 py-0.5 hover:bg-slate-100">Change units</button>
                      )}
                    </div>
                    {selectedSupplier && (
                      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-600">Supplier</span>
                          <p className="text-xs text-slate-400 truncate">{selectedSupplier.supplierName} - {selectedSupplier.collectionName}</p>
                        </div>
                        <button onClick={() => { setSelectedSupplier(null); setSupplierSkip(false); setUnitSystem(null); }} className="text-xs font-medium text-slate-400 hover:text-[#BD4A1A] transition rounded-full px-2 py-0.5 hover:bg-slate-100 flex-shrink-0 ml-2">Change supplier</button>
                      </div>
                    )}
                    <div className="pt-1">
                      <button onClick={startOver} className="text-xs font-medium text-red-400 hover:text-red-600 transition rounded-full px-3 py-1 hover:bg-red-50">Start over</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pitch input (plan mode only) */}
              {measureMode === 'plan' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:p-5 mb-6">
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
                          <label htmlFor="roof-pitch-degrees" className="sr-only">Roof pitch in degrees</label>
                          <input id="roof-pitch-degrees" name="pitchDegrees" type="number" value={masterPitch} onChange={(e) => updatePitchDegrees(e.target.value)} min={0} max={89} step={0.5} inputMode="decimal" className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-base md:text-sm text-center focus:border-orange-500 focus:outline-none" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">deg</span>
                        </div>
                        <span className="text-xs text-slate-400">= {masterRatio}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label htmlFor="roof-pitch-ratio" className="sr-only">Roof pitch ratio</label>
                        <input id="roof-pitch-ratio" name="pitchRatio" type="text" value={masterRatio} onChange={(e) => updatePitchRatio(e.target.value)} placeholder="5:12" className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-base md:text-sm text-center focus:border-orange-500 focus:outline-none" />
                        <span className="text-xs text-slate-400">= {masterPitch} deg</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Roof Area section (primary) */}
              {isGuided && <h2 className="text-sm font-semibold text-slate-900 mb-2">Step 1: Roof Area</h2>}
              {renderSection('roof_area')}

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">Additional Components</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Additional components */}
              <div className="space-y-3">
                {BUILT_IN_ORDER.filter(k => k !== 'roof_area').map(k => renderSection(k))}
                {Object.keys(customSections).map(k => renderSection(k))}
                <CustomComponentCreator onCreate={addCustomComponent} />
              </div>

              {/* Summary */}
              {hasData ? (
                <div className="mt-6 rounded-xl bg-slate-900 text-white p-4 md:p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Summary</h3>
                    <span className="text-xs text-slate-400">{totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} total</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {allKeys.map(key => {
                      const t = totals[key];
                      if (!t || t.count === 0) return null;
                      const section = allSections[key];
                      const isArea = key === 'roof_area' || key === 'underlay' || key === 'fixings' || (key.startsWith('custom-') && section.customDef?.measurementType === 'area');
                      const isFixedSummary = key.startsWith('custom-') && section.customDef?.measurementType === 'fixed';
                      const du = isFixedSummary ? 'pcs' : (isArea ? areaLbl : lenLbl);
                      return (
                        <div key={key} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <ComponentSymbol kind={key} customDef={section.customDef} className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-300 truncate">{componentLabel(key, section.customDef)}</span>
                          </div>
                          <div className="mt-1 text-sm font-semibold">{t.rawTotal.toFixed(2)} {du}</div>
                          {section.wastePercent > 0 && <div className="text-xs text-slate-400">w/ waste: {t.withWaste.toFixed(2)} {du}</div>}
                          {t.totalCost > 0 && <div className="text-xs text-[#BD4A1A] font-medium mt-0.5">{cur}{t.totalCost.toFixed(2)}</div>}
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
                  <button onClick={() => { setShowResults(true); trackEvent('free_roof_builder_generate', { entries: totalEntries }); }}
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_16px_rgba(255,107,53,0.4)] min-h-[44px]">
                    Generate Takeoff Report
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
                  <svg className="mx-auto w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
                  <p className="mt-3 text-sm text-slate-500">Start by adding your roof area measurements above.</p>
                  <p className="mt-1 text-xs text-slate-400">Then add ridge, hip, valley, barge, spouting, or custom components below.</p>
                </div>
              )}
            </>
          )}
        </div>

        {showResults && <ResultsModal sections={allSections} totals={totals} getComponentById={getComponentById} grandTotal={grandTotal} unitSystem={u} allKeys={allKeys} onClose={() => setShowResults(false)} supplier={selectedSupplier ? { name: selectedSupplier.supplierName, slug: selectedSupplier.supplierSlug, enquiriesEnabled: selectedSupplier.enquiriesEnabled } : supplierSkip ? { name: 'QuoteCore+', slug: '', enquiriesEnabled: false } : null} currency={selectedSupplier?.currency ?? (supplierSkip ? 'USD' : undefined)} resultUrl={resultUrl ?? undefined} includeLabour={includeLabour} />}

        {/* Related Tools */}
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 md:px-6 py-10 md:py-14">
            <h2 className="text-lg md:text-xl font-semibold text-slate-900 text-center">Related free tools</h2>
            <p className="mt-1 text-sm text-slate-500 text-center">More free tools built for trades.</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Roofing Calculator */}
              <Link href="/free-roofing-calculator" className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Roofing Calculator</h3>
                <p className="mt-1 text-xs text-slate-500">Calculate roof area, pitch, and materials with waste allowances.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A]">Open tool <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
              </Link>
              {/* Construction Calculator */}
              <Link href="/free-construction-calculator" className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 9H9L8 4z" /></svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Construction Calculator</h3>
                <p className="mt-1 text-xs text-slate-500">General construction math for areas, volumes, and quantities.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A]">Open tool <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
              </Link>
              {/* Quote Generator */}
              <Link href="/free-quote-generator" className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Free Quote Generator</h3>
                <p className="mt-1 text-xs text-slate-500">Create a professional quote in seconds. Print or save as PDF.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A]">Open tool <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
              </Link>
              {/* Purchase Order Generator */}
              <Link href="/free-purchase-order-generator" className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Purchase Order Generator</h3>
                <p className="mt-1 text-xs text-slate-500">Create and print professional purchase orders for suppliers.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A]">Open tool <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
              </Link>
              {/* Invoice Generator */}
              <Link href="/free-invoice-generator" className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-[#FF6B35] hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] hover:bg-orange-50/40 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <svg className="w-5 h-5 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Free Invoice Generator</h3>
                <p className="mt-1 text-xs text-slate-500">Generate and print professional invoices. No signup required.</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#BD4A1A]">Open tool <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
              </Link>
              {/* Free Tools Hub */}
              <Link href="/free-tools" className="block rounded-xl border-2 border-dashed border-slate-200 bg-white p-5 hover:border-[#FF6B35] hover:bg-orange-50/40 transition-all group flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <svg className="w-5 h-5 text-slate-500 group-hover:text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">All Free Tools</h3>
                <p className="mt-1 text-xs text-slate-500">Browse all calculators and generators.</p>
              </Link>
            </div>
          </div>
        </section>

        {!embed && <SiteFooter />}

        {/* Leave warning modal - shows when user tries to go back with data entered */}
        {showLeaveWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900">Leave the takeoff builder?</h3>
              <p className="mt-2 text-sm text-slate-500">
                You&apos;ll lose your current measurements and progress. This can&apos;t be undone.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowLeaveWarning(false)}
                  className="flex-1 rounded-full bg-black text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 transition"
                >
                  Stay on page
                </button>
                <button
                  onClick={() => {
                    setShowLeaveWarning(false);
                    clearTakeoff();
                    setMeasureMode(null);
                    setUnitSystem(null);
                    setSelectedSupplier(null);
                    setSupplierSkip(false);
                  }}
                  className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Leave & reset
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </FreeToolsAuthProvider>
  );
}
