'use client';
import { useState, useRef, useId, Fragment } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { entryLabel, addMoreLabel, measurementTypeLabel } from '@/app/lib/types';
import { linearInputToMetric, areaInputToMetric } from '@/app/lib/measurements/conversions';
import { formatArea, formatLinear, formatVolume, getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import { formatCurrency } from '@/app/lib/currency/currencies';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow, QuoteComponentEntryRow, InputMode } from '@/app/lib/types';
import type { MeasurementSystem } from '@/app/lib/types';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { PitchInput } from '@/app/components/PitchInput';
import { CreateSmartComponentModal } from '@/app/components/CreateSmartComponentModal';
import { formatQuantity, formatPricedQuantity } from './helpers';

export function ExpandableComponent({
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
  onCombineEntries,
  onSplitEntries,
  copilotId
}: {
  comp: QuoteComponentRow;
  entries: QuoteComponentEntryRow[];
  roofAreas: QuoteRoofAreaRow[];
  roofArea?: QuoteRoofAreaRow;
  quote: QuoteRow;
  currency: string;
  onAddEntry: (compId: string, rawValue: number, options?: { bypassHeightMultiplier?: boolean; bypassDepthMultiplier?: boolean; convertAs?: 'area' | 'linear' | 'volume' | 'none'; entryHeightM?: number | null; entryDepthM?: number | null }) => Promise<void>;
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
  onCombineEntries?: (compId: string) => Promise<void>;
  onSplitEntries?: (compId: string) => Promise<void>;
  copilotId?: string;
}) {
  const controlId = useId();
  // Phase 6.5: combine/split UX. Linear-shaped measurement types only.
  // database.types.ts is stale on the Phase 2 is_combined column; cast.
  const LINEAR_LIKE_TYPES = new Set([
    'lineal', 'linear', 'multi_lineal', 'curved_line',
    'rafter', 'valley_hip',
  ]);
  const isLinearLike = LINEAR_LIKE_TYPES.has(comp.measurement_type as string);
  const hasCombinedEntry = compEntries.some(
    (e) => (e as unknown as { is_combined?: boolean }).is_combined === true,
  );
  const showCombineButton =
    isLinearLike && !hasCombinedEntry && compEntries.length >= 2 && !!onCombineEntries;
  const showSplitButton = isLinearLike && hasCombinedEntry && !!onSplitEntries;
  const mt = comp.measurement_type as string;
  const isVolume3d = mt === 'volume_3d';
  const isVolumePreset = mt === 'volume';
  const isLxhFreestyle = mt === 'length_x_height_freestyle' || mt === 'multi_lineal_lxh_freestyle';
  const isLxhPreset = mt === 'length_x_height' || mt === 'multi_lineal_lxh';
  const isAreaType = mt === 'area' || mt === 'irregular_area';
  // Types that support a toggle between single-value and dimension-based entry
  const hasEntryModeToggle = isAreaType || isVolumePreset || isVolume3d || isLxhPreset;
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Entry mode for toggleable types: 'direct' = single value, 'dims' = dimension inputs
  const [entryMode, setEntryMode] = useState<'direct' | 'dims' | 'volume' | 'area_depth'>('direct');
  // Dimension inputs for W×H / L×H mode (area, volume preset, length_x_height)
  const [dimA, setDimA] = useState('');
  const [dimB, setDimB] = useState('');
  const dimRef = useRef<HTMLInputElement>(null);
  // volume_3d: separate L / W / D inputs (dims mode)
  const [vol3dL, setVol3dL] = useState('');
  const [vol3dW, setVol3dW] = useState('');
  const [vol3dD, setVol3dD] = useState('');
  const vol3dRef = useRef<HTMLInputElement>(null);
  // Volume (Preset Depth) direct volume mode: single m³ input bypasses depth
  // Volume (m³) area+depth mode: area² × custom depth = m³
  const [adArea, setAdArea] = useState('');
  const [adDepth, setAdDepth] = useState('');
  const adAreaRef = useRef<HTMLInputElement>(null);
  // length_x_height_freestyle / multi_lineal_lxh_freestyle: L × H inputs
  const [lxhFsL, setLxhFsL] = useState('');
  const [lxhFsH, setLxhFsH] = useState('');
  const lxhFsRef = useRef<HTMLInputElement>(null);
  const unit = getUnitLabel(comp.measurement_type as any, quote.measurement_system);
  // When Volume (Preset Depth) is in Area direct mode, the user enters area² not volume.
  // Show the area unit (m²/ft²) instead of the volume unit (m³/ft³).
  const displayUnit = (isVolumePreset && entryMode === 'direct')
    ? getUnitLabel('area' as any, quote.measurement_system)
    : unit;
  const label = entryLabel(comp.measurement_type);
  const addLabel = addMoreLabel(comp.measurement_type);
  const compTradeLabels = getTradeLabels((quote as { trade?: string }).trade);
  const totalCost = (comp.material_cost ?? 0) + (comp.labour_cost ?? 0);
  const hasPitch = comp.pitch_type !== 'none';
  const isAreaBased = comp.measurement_type === 'area';
  const assignedArea = roofAreas.find(a => a.id === comp.quote_roof_area_id);
  const areaPitch = assignedArea?.calc_pitch_degrees ?? 0;

  // Helper to display values with correct units
  function displayValue(value: number): string {
    const m = comp.measurement_type as string;
    if (m === 'area' || m === 'length_x_height' || m === 'multi_lineal_lxh' || m === 'irregular_area' ||
        m === 'length_x_height_freestyle' || m === 'multi_lineal_lxh_freestyle') {
      return formatArea(value, quote.measurement_system);
    }
    if (m === 'lineal' || m === 'linear' || m === 'multi_lineal' || m === 'curved_line') {
      return formatLinear(value, quote.measurement_system);
    }
    if (m === 'volume' || m === 'volume_3d') {
      return formatVolume(value, quote.measurement_system);
    }
    // quantity/fixed types - no unit conversion
    return `${value.toFixed(1)} ${getUnitLabel(comp.measurement_type as any, quote.measurement_system)}`;
  }

  async function handleSubmitEntry() {
    const val = Number(inputValue);
    if (!val || val <= 0) return;
    // Direct mode: user enters a single value. Conversion depends on type:
    // - area: user enters area -> convertAs 'area'
    // - volume (preset depth): user enters area -> convertAs 'area' (server applies depth)
    // - volume_3d: user enters volume -> convertAs 'volume'
    // - length_x_height: user enters length -> convertAs 'linear' (server applies height)
    // - lineal/etc: falls through to default linear
    const opts = isVolume3d
      ? { convertAs: 'volume' as const }
      : isVolumePreset || isAreaType
        ? { convertAs: 'area' as const }
        : isLxhPreset
          ? { convertAs: 'linear' as const }
          : undefined;
    await onAddEntry(comp.id, val, opts);
    setInputValue('');
    inputRef.current?.focus();
  }

  async function handleSubmitLxhFreestyle() {
    const L = Number(lxhFsL);
    const H = Number(lxhFsH);
    if (!L || L <= 0 || !H || H <= 0) return;
    const Lm = linearInputToMetric(L, quote.measurement_system);
    const Hm = linearInputToMetric(H, quote.measurement_system);
    // Product is already metric m²; skip auto-conversion.
    // v8: pass the entered height for read-only display on the entry row.
    await onAddEntry(comp.id, Lm * Hm, { convertAs: 'none', entryHeightM: Hm });
    setLxhFsL('');
    setLxhFsH('');
    lxhFsRef.current?.focus();
  }

  // Dimension-based entry for area (W×H), volume preset (W×H), length_x_height (L×H)
  async function handleSubmitDims() {
    const A = Number(dimA);
    const B = Number(dimB);
    if (!A || A <= 0 || !B || B <= 0) return;
    const Am = linearInputToMetric(A, quote.measurement_system);
    const Bm = linearInputToMetric(B, quote.measurement_system);
    // Product is already metric area (m²); skip auto-conversion.
    // For length_x_height: user provided L×H = area directly, bypass preset height.
    const opts = isLxhPreset
      // v8: dimB is the user's height for L×H - pass for read-only display.
      ? { bypassHeightMultiplier: true, convertAs: 'none' as const, entryHeightM: Bm }
      : { convertAs: 'none' as const };
    await onAddEntry(comp.id, Am * Bm, opts);
    setDimA('');
    setDimB('');
    dimRef.current?.focus();
  }

  async function handleSubmitVolume3d() {
    // Direct mode: single cubic volume value
    if (entryMode === 'direct') {
      const val = Number(inputValue);
      if (!val || val <= 0) return;
      await onAddEntry(comp.id, val);
      setInputValue('');
      inputRef.current?.focus();
      return;
    }
    // Dims mode: L × W × D
    const L = Number(vol3dL);
    const W = Number(vol3dW);
    const D = Number(vol3dD);
    if (!L || L <= 0 || !W || W <= 0 || !D || D <= 0) return;
    // Convert each dimension to metric then multiply - product is already metric m³.
    const Lm = linearInputToMetric(L, quote.measurement_system);
    const Wm = linearInputToMetric(W, quote.measurement_system);
    const Dm = linearInputToMetric(D, quote.measurement_system);
    // Skip auto-conversion since we already converted.
    // v8: pass the entered depth for read-only display on the entry row.
    await onAddEntry(comp.id, Lm * Wm * Dm, { convertAs: 'none', entryDepthM: Dm });
    setVol3dL('');
    setVol3dW('');
    setVol3dD('');
    vol3dRef.current?.focus();
  }

  // Volume (Preset Depth) - direct volume mode: user enters m³ directly,
  // bypassing the preset depth multiplier. Waste is applied server-side.
  async function handleSubmitDirectVolume() {
    const val = Number(inputValue);
    if (!val || val <= 0) return;
    // Convert to metric m³, bypass preset depth on server.
    await onAddEntry(comp.id, val, { convertAs: 'volume', bypassDepthMultiplier: true });
    setInputValue('');
    inputRef.current?.focus();
  }

  // Volume (m³) - area + custom depth mode: user enters area² and a depth,
  // system calculates area² × depth = m³. Bypasses preset depth (none exists
  // for volume_3d). Waste is applied server-side.
  async function handleSubmitAreaDepth() {
    const A = Number(adArea);
    const D = Number(adDepth);
    if (!A || A <= 0 || !D || D <= 0) return;
    const Am = areaInputToMetric(A, quote.measurement_system);
    const Dm = linearInputToMetric(D, quote.measurement_system);
    // Product is already metric m³; skip auto-conversion.
    // v8: pass the entered depth for read-only display on the entry row.
    await onAddEntry(comp.id, Am * Dm, { convertAs: 'none', entryDepthM: Dm });
    setAdArea('');
    setAdDepth('');
    adAreaRef.current?.focus();
  }

  function startAdding() {
    setAdding(true);
    setExpanded(true);
    setTimeout(() => {
      if (isVolume3d && entryMode === 'dims') { vol3dRef.current?.focus(); }
      else if (isVolume3d && entryMode === 'area_depth') { adAreaRef.current?.focus(); }
      else if (isVolumePreset && entryMode === 'volume') { inputRef.current?.focus(); }
      else if (isLxhFreestyle) { lxhFsRef.current?.focus(); }
      else if (hasEntryModeToggle && entryMode === 'dims') { dimRef.current?.focus(); }
      else { inputRef.current?.focus(); }
    }, 50);
  }

  return (
    <div data-qc-component="C20" className="qb-component" {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <div className="qb-component-heading">
        <button type="button" id={`${controlId}-toggle`} className="qb-component-toggle"
          aria-expanded={expanded} aria-controls={`${controlId}-panel`}
          onClick={() => setExpanded(!expanded)}>
          <svg aria-hidden="true" className="qb-disclosure-icon" data-expanded={expanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
          <span className="qb-component-name">
            <span>{comp.name}</span>
            <span className="qb-component-meta">{measurementTypeLabel(comp.measurement_type as any, quote.measurement_system)} · {compEntries.length} {compEntries.length === 1 ? 'entry' : 'entries'}</span>
          </span>
          <span className="qb-component-quantity">
            <span className="qb-mini-label">Quantity</span>
          {comp.priced_quantity != null ? (() => {
            const priced = Number(comp.priced_quantity);
            const packSnap = comp.pack_size_snapshot != null ? Number(comp.pack_size_snapshot) : null;
            const actual = Number(comp.final_quantity ?? 0);
            const fractional = packSnap && !isNaN(packSnap) && packSnap > 0 ? actual / packSnap : actual;
            return <>{priced.toFixed(0)} <span className="italic text-slate-400">({fractional.toFixed(2)})</span></>;
          })() : displayValue(comp.final_quantity ?? 0)}
          </span>
          <span className="qb-component-cost"><span className="qb-mini-label">Item + labour</span>{formatCurrency(totalCost, currency)}</span>
        </button>
        <QcButton size="sm" className="qc-icon-button qc-icon-danger" aria-label={`Remove ${comp.name}`}
          title={`Remove ${comp.name}`} onClick={e => {
            e.stopPropagation();
            onRemove(comp.id);
          }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M5 6l1 14h12l1-14M9 6V3h6v3M10 10v6m4-6v6" /></svg>
        </QcButton>
      </div>

      {expanded && (
        <div id={`${controlId}-panel`} aria-labelledby={`${controlId}-toggle`} className="qb-component-body">
          <div className="qb-setting-row">
            <span className="qc-label">Input:</span>
            {(['calculated', 'final'] as InputMode[]).map(mode => (
              <QcButton
                key={mode}
                onClick={() => onUpdateSettings(comp.id, { input_mode: mode })}
                size="sm" aria-pressed={comp.input_mode === mode} className="qc-choice"
              >
                {mode === 'calculated' ? 'Plan' : 'Actual'}
              </QcButton>
            ))}
          </div>

          {roofAreas.length > 1 && (
            <div className="qb-setting-row">
              <span className="qc-label">Area:</span>
              <QcSelect
                aria-label={`Area for ${comp.name}`}
                value={comp.quote_roof_area_id ?? ''}
                onChange={e => onUpdateSettings(comp.id, { quote_roof_area_id: e.target.value || null })}
                className="qb-assigned-area"
              >
                <option value="">None</option>
                {roofAreas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({(a.calc_pitch_degrees ?? 0).toFixed(1)}°)
                  </option>
                ))}
              </QcSelect>
            </div>
          )}

          {hasPitch && comp.input_mode === 'calculated' && (
            <div className="qb-setting-row">
              <span className="qc-label">Pitch:</span>
              <QcButton
                onClick={() => onUpdateSettings(comp.id, { use_custom_pitch: false })}
                size="sm" aria-pressed={!comp.use_custom_pitch} className="qc-choice"
              >
                Area ({areaPitch.toFixed(1)}°)
              </QcButton>
              <QcButton
                onClick={() => onUpdateSettings(comp.id, { use_custom_pitch: true })}
                size="sm" aria-pressed={comp.use_custom_pitch} className="qc-choice"
              >
                Custom
              </QcButton>
              {comp.use_custom_pitch && (
                <PitchInput
                  appearance="v2"
                  degrees={comp.custom_pitch_degrees}
                  onSave={(deg) => onUpdateSettings(comp.id, { custom_pitch_degrees: deg })}
                  compact
                  className="inline-block"
                />
              )}
            </div>
          )}

          {isAreaBased && roofArea && onUseRoofArea && (
            <QcButton
              onClick={() => onUseRoofArea(comp.id, roofArea.computed_sqm ?? 0)}
              size="sm" variant="ghost"
            >
              → Use {compTradeLabels.areaSingularLabel.toLowerCase()} total ({formatArea(roofArea.computed_sqm ?? 0, quote.measurement_system)})
            </QcButton>
          )}

          {compEntries.map((entry, idx) => {
            const isCombined = (entry as unknown as { is_combined?: boolean }).is_combined === true;
            const sourceCount = isCombined
              ? ((entry as unknown as { combined_from?: unknown[] }).combined_from ?? []).length
              : 0;
            return (
              <div key={entry.id} className="qb-entry-row">
                <span className="qb-entry-number">#{idx + 1}</span>
                <span className="qb-entry-value">
                  {displayValue(entry.raw_value)}
                </span>
                {isCombined && (
                  <span className="qb-combined-label">
                    combined from {sourceCount}
                  </span>
                )}
                {!isCombined && (() => {
                  // v8 (2026-07-08): read-only input reference display. Shows
                  // the values used to produce this entry's final value -
                  // height/depth (user-entered or preset snapshot) and pitch.
                  // Purely informational; never feeds any calculation.
                  const ei = (entry as unknown as { entry_inputs?: { height_m?: number | null; depth_m?: number | null } | null }).entry_inputs;
                  const ep = (entry as unknown as { pitch_degrees?: number | string | null }).pitch_degrees;
                  const refParts: string[] = [];
                  if (ei?.height_m && Number(ei.height_m) > 0) refParts.push(`H: ${formatLinear(Number(ei.height_m), quote.measurement_system)}`);
                  if (ei?.depth_m && Number(ei.depth_m) > 0) refParts.push(`D: ${formatLinear(Number(ei.depth_m), quote.measurement_system)}`);
                  if (comp.pitch_type !== 'none' && ep != null && Number(ep) > 0) {
                    const deg = Number(ep);
                    refParts.push(`${Number.isInteger(deg) ? deg.toFixed(0) : deg.toFixed(1)}°`);
                  }
                  const hasWaste = comp.waste_type !== 'none';
                  const valuesDiffer = Math.abs(entry.value_after_waste - entry.raw_value) > 1e-6;
                  if (!hasWaste && refParts.length === 0) return null;
                  return (
                    <span className="qb-entry-detail">
                      {(hasWaste || valuesDiffer) && <>→ {displayValue(entry.value_after_waste)}{' '}</>}
                      {hasWaste ? (
                        <span className="qb-entry-detail">- Incl waste{refParts.length > 0 ? ` (${refParts.join(' · ')})` : ''}</span>
                      ) : (
                        <span className="qb-entry-detail">- ({refParts.join(' · ')})</span>
                      )}
                    </span>
                  );
                })()}
                {!isCombined && (
                  <QcButton
                    aria-label={`Remove entry ${idx + 1} from ${comp.name}`}
                    title="Remove entry"
                    onClick={() => onRemoveEntry(entry.id, comp.id)}
                    size="sm" className="qc-icon-button qc-icon-danger qb-entry-remove"
                  >
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </QcButton>
                )}
              </div>
            );
          })}

          {/* Phase 6.5: combine / split lineal entries */}
          {(showCombineButton || showSplitButton) && (
            <div className="qb-entry-tools">
              {showCombineButton && (
                <QcButton
                  onClick={() => onCombineEntries?.(comp.id)}
                  size="sm" variant="ghost"
                >
                  Combine into total length + waste
                </QcButton>
              )}
              {showSplitButton && (
                <QcButton
                  onClick={() => onSplitEntries?.(comp.id)}
                  size="sm" variant="ghost"
                >
                  Split back into individual lengths
                </QcButton>
              )}
            </div>
          )}

          {adding ? (
            isLxhFreestyle ? (
              // Length × Height freestyle: L and H inputs (unchanged).
              <div className="qb-entry-editor">
                <div className="qb-entry-inputs">
                  {([
                    { label: 'L', val: lxhFsL, set: setLxhFsL },
                    { label: 'H', val: lxhFsH, set: setLxhFsH },
                  ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label: lbl, val, set }) => (
                    <Fragment key={lbl}>
                      <span key={`${lbl}-lbl`} className="text-xs text-slate-500 w-4">{lbl}</span>
                      <QcInput
                      aria-label={`${lbl === 'L' ? 'Length' : lbl === 'W' ? 'Width' : lbl === 'H' ? 'Height' : 'Depth'} (${getUnitLabel('lineal', quote.measurement_system)})`}
                        key={lbl}
                        ref={lbl === 'L' ? lxhFsRef : undefined}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={val}
                        onChange={e => set(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleSubmitLxhFreestyle(); }}
                        placeholder="0"
                        className="qb-dimension-input"
                      />
                    </Fragment>
                  ))}
                  <span className="text-xs text-slate-400">{getUnitLabel('lineal' as 'lineal', quote.measurement_system)}</span>
                </div>
                {lxhFsL && lxhFsH && Number(lxhFsL) > 0 && Number(lxhFsH) > 0 && (
                  <p className="text-xs text-slate-400">
                    = {(linearInputToMetric(Number(lxhFsL), quote.measurement_system) *
                        linearInputToMetric(Number(lxhFsH), quote.measurement_system)).toFixed(2)} m²
                  </p>
                )}
                <div className="qb-entry-actions">
                  <QcButton onClick={() => void handleSubmitLxhFreestyle()}
                    disabled={!lxhFsL || !lxhFsH || Number(lxhFsL) <= 0 || Number(lxhFsH) <= 0}
                    size="sm" variant="primary">
                    Add
                  </QcButton>
                  <QcButton onClick={() => { setAdding(false); setLxhFsL(''); setLxhFsH(''); }}
                    size="sm" variant="ghost">Done</QcButton>
                </div>
              </div>
            ) : hasEntryModeToggle ? (
              // Toggleable entry: area/volume/lxh types with direct or dims mode
              <div className="qb-entry-editor">
                {/* Entry mode toggle */}
                <div className="qc-choice-group">
                  {(() => {
                    let modes: { key: 'direct' | 'dims' | 'volume' | 'area_depth'; label: string; title: string }[] = [];
                    if (isAreaType) {
                      modes = [
                        { key: 'direct', label: 'Area', title: `Enter total area (${getUnitLabel('area', quote.measurement_system)})` },
                        { key: 'dims', label: 'W × L', title: `Width × Length = area (${getUnitLabel('area', quote.measurement_system)})` },
                      ];
                    } else if (isVolumePreset) {
                      modes = [
                        { key: 'direct', label: 'Area', title: 'Area × preset depth = volume' },
                        { key: 'dims', label: 'W × L', title: 'Width × Length × preset depth = volume' },
                        { key: 'volume', label: 'Volume', title: `Enter total cubic volume (${getUnitLabel('volume_3d', quote.measurement_system)})` },
                      ];
                    } else if (isVolume3d) {
                      modes = [
                        { key: 'direct', label: 'Volume', title: `Enter total cubic volume (${getUnitLabel('volume_3d', quote.measurement_system)})` },
                        { key: 'dims', label: 'L × W × D', title: `Length × Width × Depth = volume (${getUnitLabel('volume_3d', quote.measurement_system)})` },
                        { key: 'area_depth', label: 'Area + Depth', title: `Area × custom depth = volume (${getUnitLabel('volume_3d', quote.measurement_system)})` },
                      ];
                    } else if (isLxhPreset) {
                      modes = [
                        { key: 'direct', label: 'Length', title: `Length × preset height = area (${getUnitLabel('area', quote.measurement_system)})` },
                        { key: 'dims', label: 'L × H', title: `Length × Height = area (${getUnitLabel('area', quote.measurement_system)})` },
                      ];
                    }
                    return modes.map(m => (
                      <QcButton
                        key={m.key}
                        title={m.title}
                        onClick={() => {
                          setEntryMode(m.key);
                          setInputValue('');
                          setDimA(''); setDimB('');
                          setVol3dL(''); setVol3dW(''); setVol3dD('');
                          setAdArea(''); setAdDepth('');
                          setTimeout(() => {
                            if (m.key === 'dims') {
                              if (isVolume3d) vol3dRef.current?.focus();
                              else dimRef.current?.focus();
                            } else if (m.key === 'area_depth') {
                              adAreaRef.current?.focus();
                            } else {
                              inputRef.current?.focus();
                            }
                          }, 50);
                        }}
                        size="sm" aria-pressed={entryMode === m.key} className="qc-choice"
                      >
                        {m.label}
                      </QcButton>
                    ));
                  })()}
                </div>

                {entryMode === 'dims' ? (
                  isVolume3d ? (
                    // Volume 3D (L × W × D): three separate dimension inputs.
                    <>
                      <div className="qb-entry-inputs">
                        {[
                          { label: 'L', val: vol3dL, set: setVol3dL },
                          { label: 'W', val: vol3dW, set: setVol3dW },
                          { label: 'D', val: vol3dD, set: setVol3dD },
                        ].map(({ label: lbl, val, set }) => (
                          <Fragment key={lbl}>
                            <span className="text-xs text-slate-500 w-4">{lbl}</span>
                            <QcInput
                      aria-label={`${lbl === 'L' ? 'Length' : lbl === 'W' ? 'Width' : lbl === 'H' ? 'Height' : 'Depth'} (${getUnitLabel('lineal', quote.measurement_system)})`}
                              ref={lbl === 'L' ? vol3dRef : undefined}
                              type="number"
                        inputMode="decimal"
                              step="0.01"
                              value={val}
                              onChange={e => set(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') void handleSubmitVolume3d(); }}
                              placeholder="0"
                              className="qb-dimension-input"
                            />
                          </Fragment>
                        ))}
                        <span className="text-xs text-slate-400">{getUnitLabel('lineal' as 'lineal', quote.measurement_system)}</span>
                      </div>
                      {vol3dL && vol3dW && vol3dD && Number(vol3dL) > 0 && Number(vol3dW) > 0 && Number(vol3dD) > 0 && (
                        <p className="text-xs text-slate-400">
                          = {(linearInputToMetric(Number(vol3dL), quote.measurement_system) *
                              linearInputToMetric(Number(vol3dW), quote.measurement_system) *
                              linearInputToMetric(Number(vol3dD), quote.measurement_system)).toFixed(3)} m³
                        </p>
                      )}
                      <div className="qb-entry-actions">
                        <QcButton onClick={() => void handleSubmitVolume3d()}
                          disabled={!vol3dL || !vol3dW || !vol3dD || Number(vol3dL) <= 0 || Number(vol3dW) <= 0 || Number(vol3dD) <= 0}
                          size="sm" variant="primary">
                          Add
                        </QcButton>
                        <QcButton onClick={() => { setAdding(false); setVol3dL(''); setVol3dW(''); setVol3dD(''); }}
                          size="sm" variant="ghost">Done</QcButton>
                      </div>
                    </>
                  ) : (
                    // Dimension entry: W×H (area, volume preset) or L×H (length_x_height)
                    <>
                      <div className="qb-entry-inputs">
                        <span className="text-xs text-slate-500 w-4">{isLxhPreset ? 'L' : 'W'}</span>
                        <QcInput
                      aria-label={`${isLxhPreset ? 'Length' : 'Width'} (${getUnitLabel('lineal', quote.measurement_system)})`}
                          ref={dimRef}
                          type="number"
                        inputMode="decimal"
                          step="0.01"
                          value={dimA}
                          onChange={e => setDimA(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void handleSubmitDims(); }}
                          placeholder="0"
                          className="qb-dimension-input"
                        />
                        <span className="text-xs text-slate-500 w-4">{isLxhPreset ? 'H' : 'L'}</span>
                        <QcInput
                      aria-label={`${isLxhPreset ? 'Height' : 'Length'} (${getUnitLabel('lineal', quote.measurement_system)})`}
                          type="number"
                        inputMode="decimal"
                          step="0.01"
                          value={dimB}
                          onChange={e => setDimB(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void handleSubmitDims(); }}
                          placeholder="0"
                          className="qb-dimension-input"
                        />
                        <span className="text-xs text-slate-400">{getUnitLabel('lineal' as 'lineal', quote.measurement_system)}</span>
                      </div>
                      {dimA && dimB && Number(dimA) > 0 && Number(dimB) > 0 && (
                        <p className="text-xs text-slate-400">
                          = {(linearInputToMetric(Number(dimA), quote.measurement_system) *
                              linearInputToMetric(Number(dimB), quote.measurement_system)).toFixed(2)} m²
                          {isVolumePreset && ' (× depth → volume)'}
                        </p>
                      )}
                      <div className="qb-entry-actions">
                        <QcButton onClick={() => void handleSubmitDims()}
                          disabled={!dimA || !dimB || Number(dimA) <= 0 || Number(dimB) <= 0}
                          size="sm" variant="primary">
                          Add
                        </QcButton>
                        <QcButton onClick={() => { setAdding(false); setDimA(''); setDimB(''); }}
                          size="sm" variant="ghost">Done</QcButton>
                      </div>
                    </>
                  )
                ) : entryMode === 'volume' && isVolumePreset ? (
                  // Volume (Preset Depth) - direct volume mode: enter m³, bypass preset depth.
                  <div className="qb-entry-inputs">
                    <QcInput
                      aria-label={`Volume (${getUnitLabel('volume_3d', quote.measurement_system)})`}
                      ref={inputRef}
                      type="number"
                        inputMode="decimal"
                      step="0.01"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleSubmitDirectVolume();
                        if (e.key === 'Escape') { setAdding(false); setInputValue(''); }
                      }}
                      placeholder="Enter volume"
                      className="qb-value-input"
                    />
                    <span className="text-xs text-slate-400">{getUnitLabel('volume_3d' as 'volume_3d', quote.measurement_system)}</span>
                    <QcButton
                      onClick={() => void handleSubmitDirectVolume()}
                      size="sm" variant="primary"
                    >
                      Add
                    </QcButton>
                    <QcButton
                      onClick={() => { setAdding(false); setInputValue(''); }}
                      size="sm" variant="ghost"
                    >
                      Done
                    </QcButton>
                  </div>
                ) : entryMode === 'area_depth' && isVolume3d ? (
                  // Volume (m³) - area + custom depth mode: area² × depth = m³.
                  <>
                    <div className="qb-entry-inputs">
                      <span className="text-xs text-slate-500">Area</span>
                      <QcInput
                      aria-label={`Area (${getUnitLabel('area', quote.measurement_system)})`}
                        ref={adAreaRef}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={adArea}
                        onChange={e => setAdArea(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { if (adDepth) void handleSubmitAreaDepth(); else { (e.target as HTMLInputElement).blur(); } } }}
                        placeholder="0"
                        className="qb-dimension-input"
                      />
                      <span className="text-xs text-slate-500">Depth</span>
                      <QcInput
                      aria-label={`Depth (${getUnitLabel('lineal', quote.measurement_system)})`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={adDepth}
                        onChange={e => setAdDepth(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleSubmitAreaDepth(); }}
                        placeholder="0"
                        className="qb-dimension-input"
                      />
                    </div>
                    {adArea && adDepth && Number(adArea) > 0 && Number(adDepth) > 0 && (
                      <p className="text-xs text-slate-400">
                        = {(areaInputToMetric(Number(adArea), quote.measurement_system) *
                            linearInputToMetric(Number(adDepth), quote.measurement_system)).toFixed(3)} m³
                      </p>
                    )}
                    <div className="qb-entry-actions">
                      <QcButton onClick={() => void handleSubmitAreaDepth()}
                        disabled={!adArea || !adDepth || Number(adArea) <= 0 || Number(adDepth) <= 0}
                        size="sm" variant="primary">
                        Add
                      </QcButton>
                      <QcButton onClick={() => { setAdding(false); setAdArea(''); setAdDepth(''); }}
                        size="sm" variant="ghost">Done</QcButton>
                    </div>
                  </>
                ) : (
                  // Direct single-value entry
                  <div className="qb-entry-inputs">
                    <QcInput
                      aria-label={`${label} (${displayUnit})`}
                      ref={inputRef}
                      type="number"
                        inputMode="decimal"
                      step="0.01"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (isVolume3d) void handleSubmitVolume3d();
                          else handleSubmitEntry();
                        }
                        if (e.key === 'Escape') {
                          setAdding(false);
                          setInputValue('');
                        }
                      }}
                      placeholder={`Enter ${isVolume3d ? 'volume' : isAreaType || isVolumePreset ? 'area' : isLxhPreset ? 'length' : label}`}
                      className="qb-value-input"
                    />
                    <span className="text-xs text-slate-400">{displayUnit}</span>
                    <QcButton
                      onClick={() => isVolume3d ? void handleSubmitVolume3d() : handleSubmitEntry()}
                      size="sm" variant="primary"
                    >
                      Add
                    </QcButton>
                    <QcButton
                      onClick={() => {
                        setAdding(false);
                        setInputValue('');
                      }}
                      size="sm" variant="ghost"
                    >
                      Done
                    </QcButton>
                  </div>
                )}
              </div>
            ) : (
            <div className="qb-entry-inputs">
              <QcInput
                      aria-label={`${label} (${displayUnit})`}
                ref={inputRef}
                type="number"
                        inputMode="decimal"
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
                className="qb-value-input"
              />
              <span className="text-xs text-slate-400">{unit}</span>
              <QcButton
                onClick={handleSubmitEntry}
                size="sm" variant="primary"
              >
                Add
              </QcButton>
              <QcButton
                onClick={() => {
                  setAdding(false);
                  setInputValue('');
                }}
                size="sm" variant="ghost"
              >
                Done
              </QcButton>
            </div>
            )
          ) : (
            <QcButton
              onClick={startAdding}
              size="sm" variant="ghost"
            >
              + {addLabel}
            </QcButton>
          )}
        </div>
      )}
    </div>
  );
}

const CREATE_NEW_COMPONENT_ID = '__create_new_component__';
