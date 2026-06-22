'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createComponent, updateComponent, deleteComponent, createComponentCollection, renameComponentCollection, deleteComponentCollection } from './actions';
import { UpgradeModal } from '@/app/components/UpgradeModal';
import type {
  ComponentLibraryRow,
  ComponentLibraryInsert,
  ComponentType,
  MeasurementType,
  WasteType,
  PitchType,
  WasteUnit,
  PricingStrategy,
  FlashingLibraryRow,
} from '@/app/lib/types';
import {
  computePackCount,
} from '@/app/lib/pricing/engine';
import { getTradeLabels } from '@/app/lib/trades/labels';
import type { MeasurementSystem } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import { loadFlashingLibrary } from '../flashings/actions';

/** Build the radio-button labels that decorate measurement type with the company's preferred unit. */
function buildMeasurementLabels(system: MeasurementSystem): Record<MeasurementType, string> {
  const norm = normalizeMeasurementSystem(system);
  const areaUnit = norm === 'metric' ? 'mÃ‚Â²' : norm === 'imperial_ft' ? 'ftÃ‚Â²' : 'RS';
  const linealUnit = norm === 'metric' ? 'm' : 'ft';
  const volumeUnit = norm === 'metric' ? 'mÃ‚Â³' : 'ftÃ‚Â³';
  return {
    area: `Area (${areaUnit})`,
    lineal: `Linear: Single (${linealUnit})`,
    // `linear` is the legacy enum value (zero rows in production). Kept in
    // the lookup so an unmigrated row would still render a label rather
    // than crashing; new code uses `lineal`.
    linear: `Linear: Single (${linealUnit})`,
    quantity: 'Quantity',
    fixed: 'Fixed',
    // Phase 2 (Generic Trades) additions. Visible in the dropdown only when
    // NEXT_PUBLIC_GENERIC_TRADES_V1 is on; otherwise filtered out below.
    length_x_height: `Length x Height: Single (${areaUnit})`,
    volume: `Volume - Preset Depth (${volumeUnit})`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    volume_3d: `Volume (${volumeUnit})`,
    hours_days: 'Hours / Days',
    count: 'Count (each)',
    curved_line: `Curved Line (${linealUnit})`,
    irregular_area: `Irregular Area (${areaUnit})`,
    multi_lineal: `Linear: Multi-Length (${linealUnit})`,
    multi_lineal_lxh: `Length x Height: Multi-Length (${areaUnit})`,
    length_x_height_freestyle: `Length x Height: Custom (${areaUnit})`,
    multi_lineal_lxh_freestyle: `Length x Height: Multi-Length Custom (${areaUnit})`,
  };
}

/** Measurement types shown when the generic-trades flag is off. */
const ROOFING_DEFAULT_TYPES = new Set<MeasurementType>([
  'area',
  'lineal',
  'quantity',
  'fixed',
]);

const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
  per_unit: 'Per unit (default)',
  per_pack_length: 'Fixed Quantity (e.g. 20m cable rolls)',
  per_pack_area: 'Fixed Quantity (e.g. 50mÃ‚Â² tile bundles)',
  // per_pack_coverage retained for legacy components only; hidden from new
  // components via allowedStrategiesFor.
  per_pack_coverage: 'Fixed Quantity (coverage - legacy)',
  per_pack_volume: 'Fixed Quantity (e.g. 5mÃ‚Â³ concrete units)',
};

const WASTE_UNIT_LABELS: Record<WasteUnit, string> = {
  percent: 'Percentage (% of measured)',
  flat: 'Flat \u2014 total length (added once to total)',
  flat_per_segment: 'Flat \u2014 per segment (added per point-to-point length)',
};

/** Which pricing strategies are allowed for which measurement types.
 *  Mirrors ck_component_library_strategy_compat from the Phase 2 migration. */
function allowedStrategiesFor(mt: MeasurementType): PricingStrategy[] {
  // per_unit always allowed.
  const base: PricingStrategy[] = ['per_unit'];
  if (['lineal', 'linear', 'multi_lineal', 'curved_line'].includes(mt)) {
    base.push('per_pack_length');
  }
  if (['area', 'length_x_height', 'length_x_height_freestyle', 'irregular_area', 'multi_lineal_lxh', 'multi_lineal_lxh_freestyle'].includes(mt)) {
    // per_pack_coverage removed from new components; enum retained for legacy.
    base.push('per_pack_area');
  }
  if (mt === 'volume' || mt === 'volume_3d') {
    base.push('per_pack_volume');
  }
  return base;
}

const WASTE_LABELS: Record<WasteType, string> = {
  none: 'None',
  percent: 'Percentage',
  fixed: 'Fixed (total)',
  fixed_per_segment: 'Fixed (per segment)',
};

const PITCH_LABELS: Record<PitchType, string> = {
  none: 'None',
  rafter: 'Rafter Pitch',
  valley_hip: 'Valley/Hip Pitch',
};

export function ComponentList({
  initialComponents,
  workspaceSlug,
  companyMeasurementSystem = 'metric',
  companyDefaultTrade = 'roofing',
  componentCollections = [],
  componentLimit,
  componentCount,
  effectivePlanCode,
  flashingsFeatureEnabled,
  subscriptionActive,
}: {
  initialComponents: ComponentLibraryRow[];
  workspaceSlug: string;
  /** Company default measurement system; drives unit labels on this page. */
  companyMeasurementSystem?: MeasurementSystem;
  /** Company default trade; hides pitch for non-roofing trades. */
  companyDefaultTrade?: string;
  /** Component collections for the company (for library assignment UI). */
  componentCollections?: { id: string; name: string; is_bootstrap: boolean }[];
  /** Plan cap on lifetime active components. NULL = unlimited. */
  componentLimit: number | null;
  /** Lifetime active component count as of server render. Local state
   *  tracks deltas during this page session. */
  componentCount: number;
  effectivePlanCode: string;
  /** Whether the plan includes the flashings feature. Controls the
   *  Flashings entry button on this page. */
  flashingsFeatureEnabled: boolean;
  /**
   * Smoke #8 (2026-05-19): when the company's effective subscription is
   * inactive (e.g. expired trial), block the + Add Component button at
   * the click layer. DB triggers refuse the actual insert too
   * (subscription_inactive via the H-04 cap trigger which fires P0001
   * before reaching the cap check), so this is purely UX.
   */
  subscriptionActive: boolean;
}) {
  const MEASUREMENT_LABELS = buildMeasurementLabels(companyMeasurementSystem);
  // Pitch is shown when the trade requires it (roofing) or opts in optionally
  // (landscaping, concrete, insulation, electrical). pitchOptional trades show
  // the checkbox but do not require a pitch on areas.
  const _tradeLabels = getTradeLabels(companyDefaultTrade);
  const pitchVisible = _tradeLabels.pitchRequired || !!_tradeLabels.pitchOptional;
  const pitchCheckboxLabel = _tradeLabels.pitchCheckboxLabel ?? 'Apply pitch calculation';
  // When true, only Rafter Pitch is offered (no Valley/Hip).
  const pitchHidesValleyHip = !!_tradeLabels.pitchHidesValleyHip;
  // Label for the rafter pitch option - 'Rafter Pitch' for roofing, 'Rise over run' for others.
  const pitchRafterLabel = _tradeLabels.pitchRafterLabel ?? 'Rafter Pitch';
  // Material orders image label - flashings terminology only applies to roofing.
  const isRoofingTrade = companyDefaultTrade === 'roofing';
  // Drawing-library feature label: 'Flashings' for roofing, 'Drawings & Images' for all others.
  const featureLabel = _tradeLabels.featureLabel ?? 'Flashings';
  const featureLabelSingular = _tradeLabels.featureLabelSingular ?? 'Flashing';
  const imageAssignLabel = 'Assign Images (Optional)';
  const imageSelectPlaceholder = 'Select an image...';
  const imageHelperText = isRoofingTrade ? 'Add flashing drawings to use in material order forms' : 'Add images/drawings to use in material order forms';
  /** Local helper that picks the right unit suffix for a measurement type given the company's default system. */
  const unitForMeasurement = (mt: MeasurementType) =>
    getUnitLabel(mt as 'area' | 'lineal' | 'quantity' | 'fixed', companyMeasurementSystem);
  /** System-aware version of `wasteAmountSuffix(wt, mt)` from types.ts. Drives the
   *  right-hand label next to the Waste Amount input on the component editor. */
  const wasteAmountSuffix = (wt: WasteType, mt: MeasurementType): string => {
    if (wt === 'percent') return '%';
    if (wt === 'fixed') return unitForMeasurement(mt);
    return '';
  };
  /** Placeholder text inside the Waste Amount input. Mirrors the suffix unit. */
  const wasteAmountPlaceholder = (wt: WasteType, mt: MeasurementType): string => {
    if (wt === 'percent') return '% e.g. 10';
    return `e.g. 0.25 (${unitForMeasurement(mt)})`;
  };
  const [components, setComponents] = useState(initialComponents);
  const [flashings, setFlashings] = useState<FlashingLibraryRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [flashingsUpgradeOpen, setFlashingsUpgradeOpen] = useState(false);
  // Smoke #8 (2026-05-19): subscription-inactive upgrade modal. Mirrors
  // the same pattern in QuotesList.
  const [subBlockedOpen, setSubBlockedOpen] = useState(false);

  // Live cap calculation. We track the active count locally so cap
  // enforcement reflects deletes/toggles done in this session without a
  // round-trip. Soft-delete is excluded server-side; we mirror that here
  // by counting is_active !== false (treat undefined as active).
  const activeCount = components.filter((c) => c.is_active !== false).length;
  // Initial server count vs local can differ if rows were added concurrently
  // in another tab; we take the larger so we don't undershoot the cap.
  const effectiveCount = Math.max(componentCount, activeCount);
  const atCap = componentLimit !== null && effectiveCount >= componentLimit;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ComponentType>('all');
  const [measurementFilter, setMeasurementFilter] = useState<'all' | MeasurementType | 'rafter' | 'valley_hip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Component collection (library) state
  const [collections, setCollections] = useState(componentCollections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    componentCollections.find(c => c.is_bootstrap)?.id ?? componentCollections[0]?.id ?? ''
  );
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [creatingLibrary, setCreatingLibrary] = useState(false);
  const [createLibraryError, setCreateLibraryError] = useState('');

  // Active library filter: '' = All Libraries, otherwise a collection id.
  // Initialise from localStorage so the user's last-set default is applied on landing.
  const LOCAL_KEY = `qc-default-lib-${workspaceSlug}`;
  const [activeLibraryId, setActiveLibraryId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const saved = localStorage.getItem(LOCAL_KEY);
    // Validate saved id still exists in collections list before applying.
    if (saved && componentCollections.some(c => c.id === saved)) return saved;
    return '';
  });
  const [defaultLibraryFlash, setDefaultLibraryFlash] = useState<string | null>(null);
  const [savedDefaultLibId, setSavedDefaultLibId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(LOCAL_KEY) ?? '';
  });
  // Inline rename state
  const [renamingLibraryId, setRenamingLibraryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete library state
  const [deletingLibraryId, setDeletingLibraryId] = useState<string | null>(null);
  const [deleteLibraryLoading, setDeleteLibraryLoading] = useState(false);

  // Form state for dynamic fields
  const [formWasteType, setFormWasteType] = useState<WasteType>('none');
  const [formMeasurementType, setFormMeasurementType] = useState<MeasurementType>('area');
  const [formPitchEnabled, setFormPitchEnabled] = useState(false);
  const [selectedFlashingId, setSelectedFlashingId] = useState<string>('');
  const [assignedFlashings, setAssignedFlashings] = useState<string[]>([]);

  // Phase 6.5 (Generic Trades) form state. Gated behind the client flag
  // NEXT_PUBLIC_GENERIC_TRADES_V1. When off, these fields default to today's
  // behaviour and never render in the UI.
  const genericTradesEnabled =
    (process.env.NEXT_PUBLIC_GENERIC_TRADES_V1 ?? '').toLowerCase() === 'true';
  const [formHeightMm, setFormHeightMm] = useState<string>('');
  const [formDepthMm, setFormDepthMm] = useState<string>('');
  const [formHoursUnit, setFormHoursUnit] = useState<'hr' | 'day'>('hr');
  const [formWasteUnit, setFormWasteUnit] = useState<WasteUnit>('percent');
  const [formPricingStrategy, setFormPricingStrategy] = useState<PricingStrategy>('per_unit');
  const [formPackPrice, setFormPackPrice] = useState<string>('');
  const [formPackSize, setFormPackSize] = useState<string>('');
  const [formPackCoverageM2, setFormPackCoverageM2] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // If user picks a strategy that isn't allowed for the chosen measurement
  // type, snap back to per_unit. Keeps the dropdown honest under rapid
  // measurement-type changes.
  useEffect(() => {
    if (!allowedStrategiesFor(formMeasurementType).includes(formPricingStrategy)) {
      setFormPricingStrategy('per_unit');
    }
  }, [formMeasurementType, formPricingStrategy]);

  // Load flashings on mount
  useEffect(() => {
    async function fetchFlashings() {
      try {
        const data = await loadFlashingLibrary();
        setFlashings(data);
      } catch (err) {
        console.error('Failed to load flashings:', err);
      }
    }
    fetchFlashings();
  }, []);

  let filtered = filter === 'all' ? components : components.filter((c) => c.component_type === filter);

  // Library filter: when a specific library is selected, show only its components.
  if (activeLibraryId) {
    filtered = filtered.filter(c => (c as unknown as { collection_id?: string | null }).collection_id === activeLibraryId);
  }

  // Measurement/pitch filter
  if (measurementFilter === 'rafter') {
    filtered = filtered.filter(c => c.default_pitch_type === 'rafter');
  } else if (measurementFilter === 'valley_hip') {
    filtered = filtered.filter(c => c.default_pitch_type === 'valley_hip');
  } else if (measurementFilter !== 'all') {
    filtered = filtered.filter(c => c.measurement_type === measurementFilter);
  }

  // Search
  if (searchQuery) {
    const s = searchQuery.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(s));
  }

  function startEdit(comp: ComponentLibraryRow) {
    setEditingId(comp.id);
    setFormMeasurementType(comp.measurement_type);
    setFormWasteType(comp.default_waste_type);
    setFormPitchEnabled(comp.default_pitch_type !== 'none');
    setAssignedFlashings(comp.flashing_ids || []);
    setSelectedFlashingId('');
    // Phase 6.5 (Generic Trades) state - read off the (stale-typed) row.
    const c = comp as unknown as Record<string, unknown>;
    setFormHeightMm(c.height_value_mm != null ? String(c.height_value_mm) : '');
    setFormDepthMm(c.depth_value_mm != null ? String(c.depth_value_mm) : '');
    setFormWasteUnit((c.waste_unit as WasteUnit) ?? 'percent');
    setFormPricingStrategy((c.pricing_strategy as PricingStrategy) ?? 'per_unit');
    setFormPackPrice(c.pack_price != null ? String(c.pack_price) : '');
    setFormPackSize(c.pack_size != null ? String(c.pack_size) : '');
    setFormPackCoverageM2(c.pack_coverage_m2 != null ? String(c.pack_coverage_m2) : '');
    setFormNotes((c.notes as string | null) ?? '');
    // Seed collection dropdown with the component's existing collection, or bootstrap fallback.
    const existingCollectionId = (c.collection_id as string | null) ?? '';
    setSelectedCollectionId(
      existingCollectionId && collections.some(col => col.id === existingCollectionId)
        ? existingCollectionId
        : collections.find(col => col.is_bootstrap)?.id ?? collections[0]?.id ?? ''
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setFormWasteType('none');
    setFormMeasurementType('area');
    setFormPitchEnabled(false);
    setAssignedFlashings([]);
    setSelectedFlashingId('');
    setFormNotes('');
  }

  function addFlashing() {
    if (!selectedFlashingId) return;
    if (assignedFlashings.includes(selectedFlashingId)) {
      alert('This flashing is already assigned');
      return;
    }
    setAssignedFlashings(prev => [...prev, selectedFlashingId]);
    setSelectedFlashingId('');
  }

  function removeFlashing(flashingId: string) {
    setAssignedFlashings(prev => prev.filter(id => id !== flashingId));
  }

  async function handleDeleteLibrary() {
    if (!deletingLibraryId) return;
    setDeleteLibraryLoading(true);
    const result = await deleteComponentCollection(deletingLibraryId);
    setDeleteLibraryLoading(false);
    if (!result.ok) {
      alert(result.message);
      setDeletingLibraryId(null);
      return;
    }
    setCollections(prev => prev.filter(c => c.id !== deletingLibraryId));
    // If the deleted library was active, fall back to the default library.
    if (activeLibraryId === deletingLibraryId) {
      const fallback = collections.find(c => c.is_bootstrap && c.id !== deletingLibraryId);
      setActiveLibraryId(fallback?.id ?? '');
    }
    setDeletingLibraryId(null);
  }

  async function handleRenameLibrary() {
    if (!renamingLibraryId || !renameValue.trim()) return;
    setRenaming(true);
    const result = await renameComponentCollection(renamingLibraryId, renameValue);
    setRenaming(false);
    if (!result.ok) {
      alert(result.message);
      return;
    }
    setCollections(prev => prev.map(c => c.id === renamingLibraryId ? { ...c, name: result.name } : c));
    setRenamingLibraryId(null);
    setRenameValue('');
  }

  async function handleCreateLibrary() {
    if (!newLibraryName.trim()) return;
    setCreatingLibrary(true);
    setCreateLibraryError('');
    const result = await createComponentCollection(newLibraryName);
    setCreatingLibrary(false);
    if (!result.ok) {
      setCreateLibraryError(result.message);
      return;
    }
    const newCollection = { id: result.id, name: result.name, is_bootstrap: false };
    setCollections(prev => [...prev, newCollection]);
    setSelectedCollectionId(result.id);
    setNewLibraryName('');
    setShowCreateLibraryModal(false);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    // Validate per_pack_coverage requires all three pack fields.
    if (formPricingStrategy === 'per_pack_coverage') {
      if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
        alert('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
        setSaving(false);
        return;
      }
    }

    const fd = new FormData(e.currentTarget);

    const wasteType = fd.get('default_waste_type') as WasteType;
    const wasteAmountRaw = fd.get('waste_amount') as string || '0';
    const wasteAmount = Number(wasteAmountRaw) || 0;

    if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
      const decimals = wasteAmountRaw.split('.')[1];
      if (decimals && decimals.length > 2) {
        alert('Reduce your decimal places to two or less (e.g. 0.25)');
        setSaving(false);
        return;
      }
    }

    // database.types.ts has not been regenerated since Phase 2's enum
    // extension; the typed measurement_type column still narrows to the
    // 5 legacy values. Cast at the boundary - the DB accepts every value
    // in our MeasurementType union and ck_component_library_strategy_compat
    // catches anything that slips through.
    const input: ComponentLibraryInsert = {
      name: fd.get('name') as string,
      component_type: fd.get('component_type') as ComponentType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      measurement_type: fd.get('measurement_type') as any,
      default_material_rate: Number(fd.get('default_material_rate')) || 0,
      default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      default_waste_type: wasteType as any,
      default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
      default_waste_fixed: (wasteType === 'fixed' || wasteType === 'fixed_per_segment') ? wasteAmount : 0,
      default_pitch_type: formPitchEnabled ? (fd.get('default_pitch_type') as PitchType) : 'none',
      eligible_for_orders: fd.get('eligible_for_orders') === 'on',
      flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
    };

    // Phase 6.5 (Generic Trades) additions. Only attached when the client flag
    // is on, so the existing roofing flow keeps writing the exact same payload
    // shape it always did. Cast the spread because database.types.ts is stale
    // on Phase 2 columns until next typegen.
    const inputWithGenericTrades = genericTradesEnabled
      ? ({
          ...input,
          height_value_mm: (formMeasurementType === 'length_x_height' || formMeasurementType === 'multi_lineal_lxh') && formHeightMm
            ? Number(formHeightMm)
            : null,
          depth_value_mm: formMeasurementType === 'volume' && formDepthMm
            ? Number(formDepthMm)
            : null,
          waste_unit: formWasteUnit,
          pricing_strategy: formPricingStrategy,
          pack_price: formPricingStrategy === 'per_unit' || !formPackPrice ? null : Number(formPackPrice),
          pack_size: formPricingStrategy === 'per_unit' || !formPackSize ? null : Number(formPackSize),
          pack_coverage_m2:
            formPricingStrategy === 'per_pack_coverage' && formPackCoverageM2
              ? Number(formPackCoverageM2)
              : null,
          collection_id: selectedCollectionId || null,
          notes: formNotes.trim() || null,
        } as unknown as ComponentLibraryInsert)
      : { ...input, collection_id: selectedCollectionId || null, notes: formNotes.trim() || null } as unknown as ComponentLibraryInsert;

    try {
      const result = await createComponent(inputWithGenericTrades);
      if (!result.ok) {
        if (result.code === 'component_limit_reached') {
          setShowForm(false);
          setUpgradeOpen(true);
        } else {
          alert(result.code === 'internal_error' ? result.message : 'Could not create component.');
        }
        return;
      }
      setComponents((prev) => [...prev, result.data]);
      setShowForm(false);
      setFormWasteType('none');
      setFormMeasurementType('area');
      setFormPitchEnabled(false);
      setAssignedFlashings([]);
      setSelectedFlashingId('');
      // Reset Phase 6.5 form state too.
      setFormHeightMm('');
      setFormDepthMm('');
      setFormHoursUnit('hr');
      setFormWasteUnit('percent');
      setFormPricingStrategy('per_unit');
      setFormPackPrice('');
      setFormPackSize('');
      setFormPackCoverageM2('');
      setFormNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create component');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);

    // Validate per_pack_coverage requires all three pack fields.
    if (formPricingStrategy === 'per_pack_coverage') {
      if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
        alert('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
        setSaving(false);
        return;
      }
    }

    const fd = new FormData(e.currentTarget);

    const wasteType = fd.get('default_waste_type') as WasteType;
    const wasteAmountRaw = fd.get('waste_amount') as string || '0';
    const wasteAmount = Number(wasteAmountRaw) || 0;

    if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
      const decimals = wasteAmountRaw.split('.')[1];
      if (decimals && decimals.length > 2) {
        alert('Reduce your decimal places to two or less (e.g. 0.25)');
        setSaving(false);
        return;
      }
    }

    const input: Partial<ComponentLibraryInsert> = {
      name: fd.get('name') as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      measurement_type: formMeasurementType as any,
      default_material_rate: Number(fd.get('default_material_rate')) || 0,
      default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      default_waste_type: wasteType as any,
      default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
      default_waste_fixed: (wasteType === 'fixed' || wasteType === 'fixed_per_segment') ? wasteAmount : 0,
      default_pitch_type: formPitchEnabled ? (fd.get('default_pitch_type') as PitchType) : 'none',
      eligible_for_orders: fd.get('eligible_for_orders') === 'on',
      flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
    };

    // Phase 6.5 (Generic Trades) additions: same as create.
    // `formMeasurementType` is set in startEdit() and updated by the edit form's dropdown.
    const inputWithGenericTrades = genericTradesEnabled
      ? ({
          ...input,
          height_value_mm: (formMeasurementType === 'length_x_height' || formMeasurementType === 'multi_lineal_lxh') && formHeightMm
            ? Number(formHeightMm)
            : null,
          depth_value_mm: formMeasurementType === 'volume' && formDepthMm
            ? Number(formDepthMm)
            : null,
          waste_unit: formWasteUnit,
          pricing_strategy: formPricingStrategy,
          pack_price: formPricingStrategy === 'per_unit' || !formPackPrice ? null : Number(formPackPrice),
          pack_size: formPricingStrategy === 'per_unit' || !formPackSize ? null : Number(formPackSize),
          pack_coverage_m2:
            formPricingStrategy === 'per_pack_coverage' && formPackCoverageM2
              ? Number(formPackCoverageM2)
              : null,
          collection_id: selectedCollectionId || null,
          notes: formNotes.trim() || null,
        } as unknown as Partial<ComponentLibraryInsert>)
      : { ...input, collection_id: selectedCollectionId || null, notes: formNotes.trim() || null };

    try {
      const updated = await updateComponent(id, inputWithGenericTrades);
      setComponents((prev) => prev.map((c) => (c.id === id ? updated : c)));
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update component');
    } finally {
      setSaving(false);
    }
  }

  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDeleteComp() {
    if (!deleteCompId) return;
    setDeleteLoading(true);
    try {
      await deleteComponent(deleteCompId);
      setComponents((prev) => prev.filter((c) => c.id !== deleteCompId));
      setDeleteCompId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  }

  const wasteAmountLabel = wasteAmountSuffix(formWasteType, formMeasurementType);
  const wasteAmountPlaceholderText = wasteAmountPlaceholder(formWasteType, formMeasurementType);

  return (
    <div className="space-y-5">
      {/* Create Library Modal */}
      {showCreateLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Create New Library</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Library Name</label>
                <input
                  type="text"
                  value={newLibraryName}
                  onChange={e => setNewLibraryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateLibrary(); } }}
                  placeholder="e.g. Residential, Commercial"
                  maxLength={80}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              {createLibraryError && (
                <p className="text-xs text-red-600">{createLibraryError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleCreateLibrary()}
                  disabled={creatingLibrary || !newLibraryName.trim()}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatingLibrary ? 'Creating...' : 'Create Library'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateLibraryModal(false); setNewLibraryName(''); setCreateLibraryError(''); }}
                  className="px-3 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Smart ComponentsÃ¢â€žÂ¢</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your Smart ComponentsÃ¢â€žÂ¢ and extras for quotes.</p>
      </div>
      

      {/* Active library title + rename */}
      {collections.length > 0 && (
        <div className="flex items-center gap-2 mb-1">
          {renamingLibraryId && renamingLibraryId === (activeLibraryId || null) ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleRenameLibrary(); }
                  if (e.key === 'Escape') { setRenamingLibraryId(null); setRenameValue(''); }
                }}
                maxLength={80}
                className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void handleRenameLibrary()}
                disabled={renaming || !renameValue.trim()}
                className="px-3 py-1 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {renaming ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setRenamingLibraryId(null); setRenameValue(''); }}
                className="px-3 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <span className="text-base font-semibold text-slate-900">
                {activeLibraryId
                  ? ((collections.find(c => c.id === activeLibraryId)?.name ?? 'Library') + (collections.find(c => c.id === activeLibraryId)?.is_bootstrap ? ' (default)' : ''))
                  : 'All Libraries'}
              </span>
              {activeLibraryId && (
                <>
                  <button
                    type="button"
                    title="Rename library"
                    onClick={() => {
                      const col = collections.find(c => c.id === activeLibraryId);
                      if (col) { setRenamingLibraryId(activeLibraryId); setRenameValue(col.name); }
                    }}
                    className="text-slate-400 hover:text-orange-500 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {!collections.find(c => c.id === activeLibraryId)?.is_bootstrap && (
                    <button
                      type="button"
                      title="Delete library"
                      onClick={() => setDeletingLibraryId(activeLibraryId)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
      {/* Filter tabs + Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
          {(['all', 'main', 'extra'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm rounded-full font-medium transition ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'main' ? 'Main' : 'Extras'}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!subscriptionActive) {
                setSubBlockedOpen(true);
                return;
              }
              if (atCap) {
                setUpgradeOpen(true);
                return;
              }
              setShowForm(true);
            }}
            data-copilot="add-component"
            className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            + Add Smart ComponentÃ¢â€žÂ¢
            {componentLimit !== null && (
              <span className="ml-2 text-xs font-medium text-white/80">
                {effectiveCount}/{componentLimit}
              </span>
            )}
          </button>
          {flashingsFeatureEnabled ? (
            <Link
              href={`/${workspaceSlug}/flashings`}
              className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              {featureLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setFlashingsUpgradeOpen(true)}
              title={`${featureLabel} requires a higher plan`}
              className="inline-flex items-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-300"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {featureLabel}
            </button>
          )}
        </div>
      </div>

      {/* Measurement type filters */}
      <div className="flex gap-1 flex-wrap">
        {[
          { key: 'all', label: 'All Types' },
          { key: 'area', label: 'Area' },
          { key: 'lineal', label: 'Linear' },
          { key: 'rafter', label: 'Rafter Pitch' },
          { key: 'valley_hip', label: 'Hip/Valley Pitch' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setMeasurementFilter(f.key as any)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
              measurementFilter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Library filter + Search row */}
      <div className="flex items-center gap-3 flex-wrap">
        {collections.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={activeLibraryId}
              onChange={e => setActiveLibraryId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
            >
              <option value="">All Libraries</option>
              {collections.map(col => (
                <option key={col.id} value={col.id}>
                  {col.name}{col.is_bootstrap ? ' (bootstrap)' : ''}
                </option>
              ))}
            </select>
            {/* Set as default button - only shown when a specific library is selected */}
            {activeLibraryId && (
              <button
                type="button"
                title={savedDefaultLibId === activeLibraryId ? 'This is your default library' : 'Set as default library'}
                onClick={() => {
                  const isAlreadyDefault = savedDefaultLibId === activeLibraryId;
                  if (isAlreadyDefault) {
                    // Clear the default
                    localStorage.removeItem(LOCAL_KEY);
                    setSavedDefaultLibId('');
                    setDefaultLibraryFlash('Default cleared');
                  } else {
                    localStorage.setItem(LOCAL_KEY, activeLibraryId);
                    setSavedDefaultLibId(activeLibraryId);
                    const name = collections.find(c => c.id === activeLibraryId)?.name ?? 'Library';
                    setDefaultLibraryFlash(`"${name}" set as default`);
                  }
                  setTimeout(() => setDefaultLibraryFlash(null), 2000);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  savedDefaultLibId === activeLibraryId
                    ? 'bg-orange-50 border-orange-300 text-orange-600 hover:bg-orange-100'
                    : 'bg-white border-slate-300 text-slate-500 hover:border-orange-300 hover:text-orange-500'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={savedDefaultLibId === activeLibraryId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {savedDefaultLibId === activeLibraryId ? 'Default' : 'Set as default'}
              </button>
            )}
            {defaultLibraryFlash && (
              <span className="text-xs text-orange-500 font-medium animate-pulse">{defaultLibraryFlash}</span>
            )}
          </div>
        )}
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Smart ComponentsÃ¢â€žÂ¢..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">&times;</button>
          )}
        </div>
      </div>

           {showForm && (
        <div className="mb-4 p-4 border border-slate-200 rounded-xl bg-white">
          <h3 className="font-semibold text-slate-900 mb-3">New Smart ComponentÃ¢â€žÂ¢</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div data-copilot="component-name">
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input name="name" required className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div data-copilot="component-type">
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select 
                  name="component_type" 
                  required 
                  defaultValue={filter === 'extra' ? 'extra' : 'main'}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="main">Main Component</option>
                  <option value="extra">Extra</option>
                </select>
              </div>
              <div data-copilot="component-measurement">
                <label className="block text-xs text-slate-500 mb-1">Measurement</label>
                <select
                  name="measurement_type"
                  required
                  value={formMeasurementType}
                  onChange={(e) => setFormMeasurementType(e.target.value as MeasurementType)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  {(Object.entries(MEASUREMENT_LABELS) as Array<[MeasurementType, string]>)
                    // Filter the dropdown down to roofing defaults when the
                    // generic-trades flag is off; show every type when on.
                    // The legacy `linear` alias stays hidden in both modes
                    // because new rows must always use `lineal`.
                    .filter(([k]) => k !== 'linear' && k !== 'count' && k !== 'curved_line' && k !== 'irregular_area')
                    .filter(([k]) => genericTradesEnabled || ROOFING_DEFAULT_TYPES.has(k))
                    .map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                </select>
              </div>
              <div data-copilot="component-labour">
                <label className="block text-xs text-slate-500 mb-1">Labour Rate ({unitForMeasurement(formMeasurementType)})</label>
                <input name="default_labour_rate" type="number" step="0.01" placeholder="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
              </div>

              {/* Item Cost pricing: single source of truth.
                  When generic trades on: pricing strategy dropdown drives whether
                  we show per-unit Item Cost OR pack price/size fields.
                  When flag off: always show the simple Item Cost field. */}
              {genericTradesEnabled && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Item Cost</label>
                  <select
                    value={formPricingStrategy}
                    onChange={(e) => setFormPricingStrategy(e.target.value as PricingStrategy)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                  >
                    {allowedStrategiesFor(formMeasurementType).map((s) => (
                      <option key={s} value={s}>{PRICING_STRATEGY_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}
              {(!genericTradesEnabled || formPricingStrategy === 'per_unit') && (
                <div data-copilot="component-rates">
                  <label className="block text-xs text-slate-500 mb-1">Item Cost ({unitForMeasurement(formMeasurementType)})</label>
                  <input name="default_material_rate" type="number" step="0.01" placeholder="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
                </div>
              )}
              {genericTradesEnabled && formPricingStrategy !== 'per_unit' && (
                <>
                  {/* hidden zero so the form submission always has default_material_rate */}
                  <input type="hidden" name="default_material_rate" value="0" />
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Quantity Price</label>
                    <input type="number" step="0.01" placeholder="e.g. 500" value={formPackPrice} onChange={(e) => setFormPackPrice(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Quantity Amount ({formPricingStrategy === 'per_pack_length' ? 'm' : formPricingStrategy === 'per_pack_area' ? 'm\u00b2' : formPricingStrategy === 'per_pack_volume' ? 'm\u00b3' : 'qty'})
                    </label>
                    <input type="number" step="0.01" placeholder="e.g. 50" value={formPackSize} onChange={(e) => setFormPackSize(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                  </div>
                  {formPricingStrategy === 'per_pack_coverage' && (
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Coverage per pack (mÃ‚Â²)</label>
                      <input type="number" step="0.01" placeholder="e.g. 50" value={formPackCoverageM2} onChange={(e) => setFormPackCoverageM2(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                    </div>
                  )}
                </>
              )}

              <div data-copilot="component-waste">
                <label className="block text-xs text-slate-500 mb-1">Waste Type</label>
                <select
                  name="default_waste_type"
                  value={formWasteType}
                  onChange={(e) => setFormWasteType(e.target.value as WasteType)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  {Object.entries(WASTE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {formWasteType !== 'none' && (
                <div data-copilot="component-waste-amount">
                  <label className="block text-xs text-slate-500 mb-1">Waste Amount {wasteAmountLabel}</label>
                  <input name="waste_amount" type="number" step="0.01" placeholder={wasteAmountPlaceholderText} className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
                </div>
              )}

            </div>

            {/* Type-specific fields (generic trades only): height, depth, time unit. */}
            {genericTradesEnabled && (
              <TypeSpecificFields
                measurementType={formMeasurementType}
                heightMm={formHeightMm} setHeightMm={setFormHeightMm}
                depthMm={formDepthMm} setDepthMm={setFormDepthMm}
                hoursUnit={formHoursUnit} setHoursUnit={setFormHoursUnit}
              />
            )}

            {pitchVisible && (
              <>
                <div className="flex items-center gap-2" data-copilot="component-pitch">
                  <input type="checkbox" id="pitch-enabled" checked={formPitchEnabled} onChange={(e) => setFormPitchEnabled(e.target.checked)} className="rounded" />
                  <label htmlFor="pitch-enabled" className="text-xs text-slate-700">{pitchCheckboxLabel}</label>
                </div>
                {formPitchEnabled && (
                  <div data-copilot="component-pitch-type">
                    <label className="block text-xs text-slate-500 mb-1">Pitch Type</label>
                    <select name="default_pitch_type" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg">
                      <option value="rafter">{pitchRafterLabel}</option>
                      {!pitchHidesValleyHip && <option value="valley_hip">Valley/Hip Pitch</option>}
                    </select>
                  </div>
                )}
              </>
            )}
            <div className="border-t border-slate-200 pt-3 mt-3" data-copilot="component-flashings">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Material Orders</h4>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="eligible-orders" name="eligible_for_orders" defaultChecked className="rounded" />
                <label htmlFor="eligible-orders" className="text-xs text-slate-700">Include in material orders</label>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{imageAssignLabel}</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedFlashingId} 
                    onChange={(e) => setSelectedFlashingId(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                  >
                    <option value="">{imageSelectPlaceholder}</option>
                    {flashings.map(flashing => (
                      <option key={flashing.id} value={flashing.id}>
                        {flashing.name} {flashing.description && `- ${flashing.description}`}
                      </option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={addFlashing}
                    disabled={!selectedFlashingId}
                    className="px-3 py-1 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Add
                  </button>
                </div>
                {assignedFlashings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {assignedFlashings.map(flashingId => {
                      const flashing = flashings.find(f => f.id === flashingId);
                      return (
                        <div key={flashingId} className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-200">
                          <span className="text-xs text-slate-700">
                            {flashing?.name || 'Unknown'} {flashing?.description && `- ${flashing.description}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFlashing(flashingId)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">{imageHelperText}</p>
              </div>
            </div>
            {/* Notes */}
            <div className="border-t border-slate-200 pt-3 mt-3">
              <label className="block text-xs text-slate-500 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
              <p className="text-xs text-slate-400 mb-1">Explainers or usage tips visible when this component is expanded.</p>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="e.g. Use for main field area. Check manufacturer spec for coverage rate."
                rows={3}
                maxLength={500}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              {formNotes.length > 0 && (
                <p className="text-xs text-slate-400 text-right mt-0.5">{formNotes.length}/500</p>
              )}
            </div>

            {collections.length > 0 && (
              <div className="border-t border-slate-200 pt-3 mt-3">
                <label className="block text-xs text-slate-500 mb-1">Save to Library</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCollectionId}
                    onChange={e => {
                      if (e.target.value === '__create_new__') {
                        setShowCreateLibraryModal(true);
                      } else {
                        setSelectedCollectionId(e.target.value);
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  >
                    {collections.map(col => (
                      <option key={col.id} value={col.id}>
                        {col.name}{col.is_bootstrap ? ' (default)' : ''}
                      </option>
                    ))}
                    <option value="__create_new__">+ Create New Library</option>
                  </select>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2" data-copilot="component-save">
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50">
                {saving ? 'Saving...' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormWasteType('none'); setFormMeasurementType('area'); setFormPitchEnabled(false); }} className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((comp) => (
          <div key={comp.id}>
            {editingId === comp.id ? (
              <div className="p-4 border border-slate-200 rounded-xl bg-white">
                <h3 className="font-semibold text-slate-900 mb-3">Edit {comp.name}</h3>
                <form onSubmit={(e) => handleUpdate(e, comp.id)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Name</label>
                      <input name="name" required defaultValue={comp.name} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Measurement</label>
                      <select
                        value={formMeasurementType}
                        onChange={(e) => setFormMeasurementType(e.target.value as MeasurementType)}
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                      >
                        {(Object.entries(MEASUREMENT_LABELS) as Array<[MeasurementType, string]>)
                          .filter(([k]) => k !== 'linear' && k !== 'count' && k !== 'curved_line' && k !== 'irregular_area')
                          .filter(([k]) => genericTradesEnabled || ROOFING_DEFAULT_TYPES.has(k))
                          .map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Labour Rate ({unitForMeasurement(formMeasurementType)})</label>
                      <input name="default_labour_rate" type="number" step="0.01" defaultValue={comp.default_labour_rate ?? 0} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                    </div>

                    {/* Item Cost - unified: strategy dropdown drives per-unit vs pack. */}
                    {genericTradesEnabled && (
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Item Cost</label>
                        <select
                          value={formPricingStrategy}
                          onChange={(e) => setFormPricingStrategy(e.target.value as PricingStrategy)}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                        >
                          {allowedStrategiesFor(formMeasurementType).map((s) => (
                            <option key={s} value={s}>{PRICING_STRATEGY_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {(!genericTradesEnabled || formPricingStrategy === 'per_unit') && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Item Cost ({unitForMeasurement(formMeasurementType)})</label>
                        <input name="default_material_rate" type="number" step="0.01" defaultValue={comp.default_material_rate ?? 0} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                      </div>
                    )}
                    {genericTradesEnabled && formPricingStrategy !== 'per_unit' && (
                      <>
                        <input type="hidden" name="default_material_rate" value="0" />
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Quantity Price</label>
                          <input type="number" step="0.01" placeholder="e.g. 500" value={formPackPrice} onChange={(e) => setFormPackPrice(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">
                            Quantity Amount ({formPricingStrategy === 'per_pack_length' ? 'm' : formPricingStrategy === 'per_pack_area' ? 'm\u00b2' : formPricingStrategy === 'per_pack_volume' ? 'm\u00b3' : 'qty'})
                          </label>
                          <input type="number" step="0.01" placeholder="e.g. 50" value={formPackSize} onChange={(e) => setFormPackSize(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                        </div>
                        {formPricingStrategy === 'per_pack_coverage' && (
                          <div className="col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">Coverage per pack (mÃ‚Â²)</label>
                            <input type="number" step="0.01" placeholder="e.g. 50" value={formPackCoverageM2} onChange={(e) => setFormPackCoverageM2(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Waste Type</label>
                      <select
                        name="default_waste_type"
                        value={formWasteType}
                        onChange={(e) => setFormWasteType(e.target.value as WasteType)}
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                      >
                        {Object.entries(WASTE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    {formWasteType !== 'none' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Waste Amount {wasteAmountSuffix(formWasteType, formMeasurementType)}</label>
                        <input
                          name="waste_amount"
                          type="number"
                          step="0.01"
                          defaultValue={formWasteType === 'percent' ? comp.default_waste_percent : comp.default_waste_fixed}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                        />
                      </div>
                    )}

                  </div>

                  {/* Type-specific fields (generic trades only). */}
                  {genericTradesEnabled && (
                    <TypeSpecificFields
                      measurementType={formMeasurementType}
                      heightMm={formHeightMm} setHeightMm={setFormHeightMm}
                      depthMm={formDepthMm} setDepthMm={setFormDepthMm}
                      hoursUnit={formHoursUnit} setHoursUnit={setFormHoursUnit}
                    />
                  )}

                  {pitchVisible && (
                    <>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`pitch-${comp.id}`} checked={formPitchEnabled} onChange={(e) => setFormPitchEnabled(e.target.checked)} className="rounded" />
                        <label htmlFor={`pitch-${comp.id}`} className="text-xs text-slate-700">{pitchCheckboxLabel}</label>
                      </div>
                      {formPitchEnabled && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Pitch Type</label>
                          <select name="default_pitch_type" defaultValue={comp.default_pitch_type} className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
                            <option value="rafter">{pitchRafterLabel}</option>
                            {!pitchHidesValleyHip && <option value="valley_hip">Valley/Hip Pitch</option>}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Material Orders</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" id={`eligible-orders-${comp.id}`} name="eligible_for_orders" defaultChecked={comp.eligible_for_orders ?? true} className="rounded" />
                      <label htmlFor={`eligible-orders-${comp.id}`} className="text-xs text-slate-700">Include in material orders</label>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{imageAssignLabel}</label>
                      <div className="flex gap-2">
                        <select 
                          value={selectedFlashingId} 
                          onChange={(e) => setSelectedFlashingId(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                        >
                          <option value="">{imageSelectPlaceholder}</option>
                          {flashings.map(flashing => (
                            <option key={flashing.id} value={flashing.id}>
                              {flashing.name} {flashing.description && `- ${flashing.description}`}
                            </option>
                          ))}
                        </select>
                        <button 
                          type="button" 
                          onClick={addFlashing}
                          disabled={!selectedFlashingId}
                          className="px-3 py-1 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Add
                        </button>
                      </div>
                      {assignedFlashings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {assignedFlashings.map(flashingId => {
                            const flashing = flashings.find(f => f.id === flashingId);
                            return (
                              <div key={flashingId} className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-200">
                                <span className="text-xs text-slate-700">
                                  {flashing?.name || 'Unknown'} {flashing?.description && `- ${flashing.description}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeFlashing(flashingId)}
                                  className="text-red-600 hover:text-red-700 text-xs font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{imageHelperText}</p>
                    </div>
                  </div>
                  {/* Notes */}
                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <label className="block text-xs text-slate-500 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                    <p className="text-xs text-slate-400 mb-1">Explainers or usage tips visible when this component is expanded.</p>
                    <textarea
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="e.g. Use for main field area. Check manufacturer spec for coverage rate."
                      rows={3}
                      maxLength={500}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    {formNotes.length > 0 && (
                      <p className="text-xs text-slate-400 text-right mt-0.5">{formNotes.length}/500</p>
                    )}
                  </div>

                  {collections.length > 0 && (
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <label className="block text-xs text-slate-500 mb-1">Save to Library</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedCollectionId}
                          onChange={e => {
                            if (e.target.value === '__create_new__') {
                              setShowCreateLibraryModal(true);
                            } else {
                              setSelectedCollectionId(e.target.value);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg"
                        >
                          {collections.map(col => (
                            <option key={col.id} value={col.id}>
                              {col.name}{col.is_bootstrap ? ' (default)' : ''}
                            </option>
                          ))}
                          <option value="__create_new__">+ Create New Library</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div 
                onClick={() => startEdit(comp)}
                title="Click to view component"
                className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900">{comp.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comp.component_type === 'main' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                      {comp.component_type}
                    </span>
                    <span className="text-xs text-slate-400">{MEASUREMENT_LABELS[comp.measurement_type]}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Item Cost: ${(comp.default_material_rate ?? 0).toFixed(2)}/{unitForMeasurement(comp.measurement_type)} Ã‚Â· Labour: ${(comp.default_labour_rate ?? 0).toFixed(2)}/{unitForMeasurement(comp.measurement_type)}
                    {comp.default_waste_type !== 'none' && (
                      <> Ã‚Â· Waste: {comp.default_waste_type === 'percent' ? `${comp.default_waste_percent}%` : `${comp.default_waste_fixed} ${unitForMeasurement(comp.measurement_type)}`}</>
                    )}
                    {comp.default_pitch_type !== 'none' && <> Ã‚Â· {PITCH_LABELS[comp.default_pitch_type]}</>}
                  </p>
                  {(comp as unknown as { notes?: string | null }).notes && (
                    <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">
                      {(comp as unknown as { notes?: string | null }).notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(comp); }}
                  title="Click to edit"
                  className="p-1.5 rounded-full text-slate-400 hover:text-orange-600 hover:bg-orange-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)] transition opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteCompId(comp.id); }} 
                  title="Click to delete"
                  className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)] transition opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteCompId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Smart ComponentÃ¢â€žÂ¢</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The Smart ComponentÃ¢â€žÂ¢ will be removed from your library.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteCompId(null)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={deleteLoading}>Cancel</button>
              <button onClick={confirmDeleteComp} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Library Confirm Modal */}
      {deletingLibraryId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Library</h3>
            <p className="text-sm text-slate-500 mt-2">
              Are you sure? You will lose all the components in the library. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeletingLibraryId(null)}
                disabled={deleteLibraryLoading}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteLibrary()}
                disabled={deleteLibraryLoading}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLibraryLoading ? 'Deleting...' : 'Delete Library'}
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={`Smart ComponentsÃ¢â€žÂ¢ library full on ${effectivePlanCode === 'trial' ? 'the free trial' : `the ${effectivePlanCode} plan`}`}
        description={`YouÃ¢â‚¬â„¢ve reached your ${componentLimit ?? 0} Smart ComponentÃ¢â€žÂ¢ limit. Upgrade your plan to add more Smart ComponentsÃ¢â€žÂ¢ to your library.`}
        recommendedPlan="growth"
      />

      <UpgradeModal
        open={flashingsUpgradeOpen}
        onClose={() => setFlashingsUpgradeOpen(false)}
        title={`${featureLabelSingular} drawings require a higher plan`}
        description={`Upgrade your account to access the ${featureLabel.toLowerCase()} drawing tool and reusable library.`}
        recommendedPlan="pro"
      />
      <UpgradeModal
        open={subBlockedOpen}
        onClose={() => setSubBlockedOpen(false)}
        title="Your trial period has ended"
        description="You need to subscribe to a plan to create more Smart ComponentsÃ¢â€žÂ¢. Your existing Smart ComponentsÃ¢â€žÂ¢ remain viewable on any plan."
        ctaLabel="View plans"
        recommendedPlan="starter"
      />
    </div>
  );
}

/**
 * Type-specific dimension fields shown only when the generic-trades flag is on.
 * Handles measurement types that need extra configuration: height for
 * length_x_height, depth for volume, time-unit for hours_days.
 * Pricing strategy and waste interpretation are now inline in the main form.
 */
function TypeSpecificFields(props: {
  measurementType: MeasurementType;
  heightMm: string;
  setHeightMm: (v: string) => void;
  depthMm: string;
  setDepthMm: (v: string) => void;
  hoursUnit: 'hr' | 'day';
  setHoursUnit: (v: 'hr' | 'day') => void;
}) {
  const { measurementType, heightMm, setHeightMm, depthMm, setDepthMm, hoursUnit, setHoursUnit } = props;
  if (!['length_x_height', 'multi_lineal_lxh', 'volume', 'volume_3d', 'hours_days'].includes(measurementType)) return null;
  return (
    <div className="space-y-3 mt-1">
      {(measurementType === 'length_x_height' || measurementType === 'multi_lineal_lxh') && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Component height (mm)</label>
          <input type="number" step="1" placeholder="e.g. 2400" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
          <p className="text-xs text-slate-400 mt-1">Area = measured length x height.</p>
        </div>
      )}
      {/* volume_3d has NO preset depth - depth is entered per measurement in the quote builder / takeoff */}
      {measurementType === 'volume' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Component depth (mm)</label>
          <input type="number" step="1" placeholder="e.g. 100" value={depthMm} onChange={(e) => setDepthMm(e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
          <p className="text-xs text-slate-400 mt-1">Volume = measured area x depth.</p>
        </div>
      )}
      {measurementType === 'hours_days' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Time unit</label>
          <select value={hoursUnit} onChange={(e) => setHoursUnit(e.target.value as 'hr' | 'day')} className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
            <option value="hr">Hours</option>
            <option value="day">Days</option>
          </select>
        </div>
      )}
    </div>
  );
}
