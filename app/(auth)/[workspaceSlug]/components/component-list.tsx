'use client';
import { demoComponentCalculated, refreshDemoGuide } from '@/app/lib/demo/client-events';
import { useSearchParams } from 'next/navigation';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import { useQcActionNotice } from '@/app/components/ui/v2/QcActionNotice';
import { SmartComponentEditor, type ComponentEditorSettings, type ComponentEditorInitial } from '@/app/components/pricing/SmartComponentEditor';
import { PricingIntroduction } from '@/app/components/pricing/PricingIntroduction';
import { canonicalUnit } from '@/app/components/pricing/componentTest';
import { formatCurrency } from '@/app/lib/currency/currencies';

import { QcLibrary } from '@/app/components/ui/v2/QcLibrary';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useState, useEffect, useRef } from 'react';
import { createComponent, updateComponent, deleteComponent, createComponentCollection, renameComponentCollection, deleteComponentCollection, dismissComponentEditWarning } from './actions';
import { AddFromCatalogModal } from './components/AddFromCatalogModal';
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
import { getTradeLabels } from '@/app/lib/trades/labels';
import type { MeasurementSystem } from '@/app/lib/types';
import { loadFlashingLibrary } from '../drawings/actions';
import { loadCalcDraftAsync, clearCalcDraft } from '@/app/(public)/free-calculators/_shared/types';

/** Build the radio-button labels that decorate measurement type with the company's preferred unit. */
// F-15: Extracted helpers + sub-components
import { buildMeasurementLabels, allowedStrategiesFor, PITCH_LABELS } from './parts/helpers';
import { PublishLibraryModal } from './components/PublishLibraryModal';
export function ComponentList({
  initialComponents,
  workspaceSlug,
  companyMeasurementSystem = 'metric',
  companyDefaultTrade = 'roofing',
  companyCurrency = 'NZD',
  showPricingIntroduction = false,
  reviewImported = false,
  componentCollections = [],
  editWarningDismissed = false,
  restoreDraftId,
  highlightComponentId,
  isSupplier = false,
  demoDefaultLibraryId,
}: {
  initialComponents: ComponentLibraryRow[];
  workspaceSlug: string;
  /** Company default measurement system; drives unit labels on this page. */
  companyMeasurementSystem?: MeasurementSystem;
  /** Company default trade; hides pitch for non-roofing trades. */
  companyDefaultTrade?: string;
  companyCurrency?: string;
  showPricingIntroduction?: boolean;
  reviewImported?: boolean;
  /** Component collections for the company (for library assignment UI). */
  componentCollections?: { id: string; name: string; is_bootstrap: boolean; visibility?: string | null; publication_status?: string | null; public_title?: string | null; public_description?: string | null; roofing_types?: string[] | null; product_categories?: string[] | null; brands?: string[] | null; keywords?: string[] | null; }[];
  /** Demo only: library pre-selected on first landing instead of "All Libraries" (owner 2026-10-05). */
  demoDefaultLibraryId?: string;
  /** Per-user: true when the user has ticked "Don't show me this warning anymore". */
  editWarningDismissed?: boolean;
  /** Draft ID from ?restore= query param - loads a saved calculator draft. */
  restoreDraftId?: string;
  /** Component ID from ?created= - scrolls to + highlights a component just
   *  created from a free-calculator draft (restore-calc-draft route). */
  highlightComponentId?: string;
  /** Whether this company is an approved supplier. Shows publishing controls. */
  isSupplier?: boolean;
}) {
  const demoSearch = useSearchParams();
  const openedDemoTarget = useRef<string | null>(null);
  const { notify, ask, feedback } = useQcFeedback();
  const { notice, showNotice } = useQcActionNotice();
  const [learning, setLearning] = useState(showPricingIntroduction);
  const [testedInSession, setTestedInSession] = useState(false);
  const [createdInSession, setCreatedInSession] = useState(false);
  const [ownTested, setOwnTested] = useState(false);
  const [draftTested, setDraftTested] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [testOnOpen, setTestOnOpen] = useState(false);
  const [testRequest, setTestRequest] = useState(0);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const [createDefaults, setCreateDefaults] = useState<ComponentEditorInitial | null>(null);
  const editorAnchor = useRef<HTMLDivElement>(null);
  const [catalogueChanged, setCatalogueChanged] = useState(false);
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
  const imageHelperText = isRoofingTrade ? 'Add flashing drawings to use in material order forms' : 'Add images/drawings to use in material order forms';
  const [components, setComponents] = useState(initialComponents);
  const [flashings, setFlashings] = useState<FlashingLibraryRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ComponentType>('all');
  const [measurementFilter, setMeasurementFilter] = useState<'all' | MeasurementType | 'rafter' | 'valley_hip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Component collection (library) state
  const [collections, setCollections] = useState(componentCollections);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    (componentCollections.find(c => (c as { is_default_takeoff_library?: boolean }).is_default_takeoff_library)
      ?? componentCollections.find(c => c.is_bootstrap)
      ?? componentCollections[0])?.id ?? ''
  );
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [creatingLibrary, setCreatingLibrary] = useState(false);
  const [createLibraryError, setCreateLibraryError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Active library filter: '' = All Libraries, otherwise a collection id.
  // Initialise from localStorage so the user's last-set default is applied on landing.
  const LOCAL_KEY = `qc-default-lib-${workspaceSlug}`;
  const [activeLibraryId, setActiveLibraryId] = useState<string>(() => {
    if (reviewImported || typeof window === 'undefined') return '';
    const saved = localStorage.getItem(LOCAL_KEY);
    // Validate saved id still exists in collections list before applying.
    if (saved && componentCollections.some(c => c.id === saved)) return saved;
    // Demo (owner 2026-10-05): first landing shows the seeded default (Roofing)
    // library rather than a mixed "All Libraries" view.
    if (demoDefaultLibraryId && componentCollections.some(c => c.id === demoDefaultLibraryId)) return demoDefaultLibraryId;
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
  // Publish library modal (supplier-only)
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);

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

  // Calculator draft restore (H-04): pre-fill form from a saved draft
  const [restoredName, setRestoredName] = useState<string>('');
  const [restoredMaterialRate, setRestoredMaterialRate] = useState<string>('');
  const [restoredLabourRate, setRestoredLabourRate] = useState<string>('');
  const [restoredWasteAmount, setRestoredWasteAmount] = useState<string>('');
  const [draftConsumed, setDraftConsumed] = useState(false);
  // ?created= highlight: glow the freshly created component, then fade.
  const [highlightId, setHighlightId] = useState<string | null>(highlightComponentId ?? null);
  const [formPackPrice, setFormPackPrice] = useState<string>('');
  const [formPackSize, setFormPackSize] = useState<string>('');
  const [formPackCoverageM2, setFormPackCoverageM2] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // If user picks a strategy that isn't allowed for the chosen measurement
  // type, snap back to per_unit. Keeps the dropdown honest under rapid
  // measurement-type changes.
  useEffect(() => {
    if (!allowedStrategiesFor(formMeasurementType).includes(formPricingStrategy) &&
        !(formPricingStrategy === 'per_pack_coverage' && allowedStrategiesFor(formMeasurementType).includes('per_pack_area'))) {
      setFormPricingStrategy('per_unit');
    }
  }, [formMeasurementType, formPricingStrategy]);

  // ?created= highlight: scroll the new component into view, clear the
  // glow after a few seconds, and clean up any leftover signup cookies.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`component-row-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    for (const name of ['qcp_signup_draft', 'qcp_signup_ref']) {
      document.cookie = `${name}=; path=/; max-age=0`;
      const h = window.location.hostname.toLowerCase();
      if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
        document.cookie = `${name}=; path=/; max-age=0; domain=.quote-core.com`;
      }
    }
    const timer = setTimeout(() => setHighlightId(null), 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Calculator draft restore (H-04): load draft (localStorage fast path,
  // then the server copy - drafts created on the marketing domain are not
  // in this origin's localStorage) and pre-fill the form.
  useEffect(() => {
    if (!restoreDraftId || draftConsumed) return;
    let cancelled = false;
    (async () => {
    const draft = await loadCalcDraftAsync(restoreDraftId);
    if (!draft || cancelled) return;
    const draftData = draft.data as {
      spec?: {
        name?: string;
        measurementType?: string;
        wasteType?: string;
        wasteValue?: string;
        pricePerUnit?: string;
        labourAmount?: string;
        pitchEnabled?: boolean;
        pitchType?: string;
        pitchDegrees?: string;
        pricingStrategy?: string;
        packSize?: string;
      };
      result?: { materialCost?: number; labourCost?: number };
    };
    const spec = draftData.spec;
    if (!spec) return;
    // Pre-fill form state
    setFormMeasurementType((spec.measurementType as MeasurementType) || 'area');
    setFormWasteType((spec.wasteType as WasteType) || 'none');
    setFormPitchEnabled(spec.pitchEnabled ?? false);
    if (spec.pricingStrategy) setFormPricingStrategy(spec.pricingStrategy as PricingStrategy);
    if (spec.packSize) setFormPackSize(spec.packSize);
    // Pre-fill text inputs via state (rendered as defaultValue only on first render)
    setRestoredName(spec.name || '');
    setRestoredMaterialRate(spec.pricePerUnit || '');
    setRestoredLabourRate(spec.labourAmount || '');
    setRestoredWasteAmount(spec.wasteValue || '');
    // Open the form
    setShowForm(true);
    setDraftConsumed(true);
    // Clear the signup cookies so the dashboard banner doesn't show again
    // (both host-only and cross-subdomain variants).
    for (const name of ['qcp_signup_draft', 'qcp_signup_ref']) {
      document.cookie = `${name}=; path=/; max-age=0`;
      const h = window.location.hostname.toLowerCase();
      if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
        document.cookie = `${name}=; path=/; max-age=0; domain=.quote-core.com`;
      }
    }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDraftId]);

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

  // Sort by name.
  filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  async function mayLeaveEditor() {
    if (saving) return false;
    if (!editorDirty) return true;
    return ask({ title: 'Leave unsaved component settings?', description: 'Testing does not save your changes. Keep editing to save them first.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true });
  }

  async function startEdit(comp: ComponentLibraryRow, openTest = false) {
    if (editingId === comp.id) {
      if (openTest) setTestRequest(value => value + 1);
      editorAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    if (!(await mayLeaveEditor())) return;
    setShowForm(false);
    setEditorDirty(false);
    setEditorVersion(value => value + 1);
    setTestOnOpen(openTest); setTestRequest(0);
    setEditingId(comp.id);
    setFormError(null);
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

  useEffect(() => {
    if (!workspaceSlug.startsWith('demo-')) return;
    const id = demoSearch.get('demoComponent');
    const key = `${id}:${demoSearch.get('demoTest')}:${demoSearch.get('demoVisit') ?? ''}`;
    if (!id || openedDemoTarget.current === key) return;
    const component = components.find(item => item.id === id);
    if (!component) return;
    openedDemoTarget.current = key;
    setActiveLibraryId('');
    void startEdit(component, demoSearch.get('demoTest') === '1');
    // Only an explicit navigation request opens the editor. Subsequent typing
    // must not re-open/reset it as component or editor state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSearch, workspaceSlug]);

  // Demo guide: ?demoCreate=1 opens the create form directly (guide CTA).
  const openedDemoCreateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceSlug.startsWith('demo-')) return;
    const visit = demoSearch.get('demoVisit') ?? 'initial';
    if (demoSearch.get('demoCreate') !== '1' || openedDemoCreateRef.current === visit) return;
    openedDemoCreateRef.current = visit;
    // Same dirty-state protection as a normal editor switch. A guide link must
    // never silently discard a visitor's in-progress component.
    void (async () => {
      if (!(await mayLeaveEditor()) || openedDemoCreateRef.current !== visit) return;
      setEditorDirty(false); setEditingId(null); setTestOnOpen(false); setTestRequest(0);
      // Keep demo rates illustrative; do not alter product calculation logic.
      setRestoredName(''); setFormMeasurementType('area'); setFormWasteType('none'); setFormPitchEnabled(false);
      setFormPricingStrategy('per_unit'); setRestoredMaterialRate('10'); setRestoredLabourRate('5'); setRestoredWasteAmount('');
      setSelectedCollectionId(demoDefaultLibraryId || activeLibraryId || collections.find(c => c.is_bootstrap)?.id || collections[0]?.id || '');
      setEditorVersion(value => value + 1);
      setShowForm(true);
      requestAnimationFrame(() => editorAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSearch, workspaceSlug]);

  // Demo-only surface signal: the helper follows the actual editor, not just
  // a ?demoComponent URL that may remain after Cancel. No product save is implied.
  useEffect(() => {
    if (!workspaceSlug.startsWith('demo-')) return;
    const report = () => window.dispatchEvent(new CustomEvent('qc-demo-component-surface', { detail: {
      kind: editingId ? (testOnOpen ? 'test' : 'edit') : showForm ? 'create' : 'closed',
      ...(editingId ? { componentId: editingId } : {}),
    } }));
    report();
    window.addEventListener('qc-demo-component-surface-request', report);
    return () => {
      window.removeEventListener('qc-demo-component-surface-request', report);
      window.dispatchEvent(new CustomEvent('qc-demo-component-surface', { detail: { kind: 'closed' } }));
    };
  }, [workspaceSlug, editingId, showForm, testOnOpen]);

  function cancelEdit() {
    setEditorDirty(false);
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
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
      setFormError('This image is already assigned. Choose a different image.');
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
      await notify(result.message);
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
      await notify(result.message);
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
    setFormError(null);

    // Suppliers: SKU required for components in published libraries
    if (isSupplier) {
      const activeCol = collections.find(c => c.id === activeLibraryId);
      const isPublishedLib = activeCol?.visibility === 'published';
      const skuVal = (new FormData(e.currentTarget).get('sku') as string)?.trim();
      if (isPublishedLib && !skuVal) {
        setFormError('SKU / Product Code is required for components in published supplier libraries.');
        setSaving(false);
        return;
      }
    }

    // Validate per_pack_coverage requires all three pack fields.
    if (formPricingStrategy === 'per_pack_coverage') {
      if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
        setFormError('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
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
        setFormError('Reduce your decimal places to two or less (e.g. 0.25)');
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
      sku: (fd.get('sku') as string)?.trim() || null,
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
        setFormError(result.code === 'internal_error' ? result.message : 'Could not create component.');
        return;
      }
      setComponents((prev) => [...prev, result.data]);
      setEditorDirty(false);
      setCreateDefaults(null);
      setCreatedInSession(true);
      setLastCreatedId(result.data.id); refreshDemoGuide();
      setOwnTested(draftTested);
      setDraftTested(false);
      setActiveLibraryId(selectedCollectionId);
      setFilter('all'); setMeasurementFilter('all'); setSearchQuery('');
      showNotice({ title: 'Component saved', tone: 'success', focus: true,
        description: `${result.data.name} is saved in your library. Check another component or price a job when your costs are ready.` });
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
      // Clear restored draft values
      setRestoredName('');
      setRestoredMaterialRate('');
      setRestoredLabourRate('');
      setRestoredWasteAmount('');
      // Clear the calculator draft from localStorage after successful import
      if (restoreDraftId) {
        clearCalcDraft(restoreDraftId);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create component');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();

    // Suppliers: SKU required for components in published libraries, and cannot be changed once published
    if (isSupplier) {
      const activeCol = collections.find(c => c.id === activeLibraryId);
      const isPublishedLib = activeCol?.visibility === 'published';
      const skuVal = (new FormData(e.currentTarget).get('sku') as string)?.trim();
      if (isPublishedLib && !skuVal) {
        setFormError('SKU / Product Code is required for components in published supplier libraries.');
        return;
      }
    }

    // Validate per_pack_coverage requires all three pack fields.
    if (formPricingStrategy === 'per_pack_coverage') {
      if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
        setFormError('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
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
        setFormError('Reduce your decimal places to two or less (e.g. 0.25)');
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
      sku: (fd.get('sku') as string)?.trim() || null,
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

    // If the user hasn't permanently dismissed the warning, show the modal
    // and stash the data for confirmation.
    if (!editWarningDismissedState) {
      setPendingUpdateData({ id, input: inputWithGenericTrades });
      setEditWarningDontShow(false);
      setEditWarningOpen(true);
      return;
    }

    // Already dismissed - proceed directly.
    await confirmUpdate(id, inputWithGenericTrades);
  }

  async function confirmUpdate(id: string, input: Partial<ComponentLibraryInsert>) {
    setSaving(true);
    try {
      const updated = await updateComponent(id, input);
      setComponents((prev) => prev.map((c) => (c.id === id ? updated : c)));
      cancelEdit();
      showNotice({ title: 'Component saved', tone: 'success', focus: true, description: `${updated.name} has been updated. Testing explains the calculation; you remain responsible for checking your business costs.` });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update component');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmEditWarning() {
    if (!pendingUpdateData) return;
    const { id, input } = pendingUpdateData;

    // If user ticked "don't show again", persist to DB.
    if (editWarningDontShow) {
      try {
        await dismissComponentEditWarning();
        setEditWarningDismissedState(true);
      } catch (err) {
        // Non-fatal: the warning will show again next time. Log and continue.
        console.error('Failed to persist edit warning dismissal:', err);
      }
    }

    setEditWarningOpen(false);
    setPendingUpdateData(null);
    await confirmUpdate(id, input);
  }

  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Component edit warning modal state
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const [editWarningDontShow, setEditWarningDontShow] = useState(false);
  const [editWarningDismissedState, setEditWarningDismissedState] = useState(editWarningDismissed);
  const [pendingUpdateData, setPendingUpdateData] = useState<{ id: string; input: Partial<ComponentLibraryInsert> } | null>(null);

  async function confirmDeleteComp() {
    if (!deleteCompId) return;
    setDeleteLoading(true);
    try {
      await deleteComponent(deleteCompId);
      setComponents((prev) => prev.filter((c) => c.id !== deleteCompId));
      if (deleteCompId === editingId) cancelEdit();
      setDeleteCompId(null);
    } catch (err) {
      showNotice({ title: 'Component was not deleted', tone: 'danger', description: err instanceof Error ? err.message : 'Please try again.', focus: true });
    } finally {
      setDeleteLoading(false);
    }
  }


  const editingComponent = components.find(component => component.id === editingId);
  function initialForComponent(component: ComponentLibraryRow): ComponentEditorInitial {
    const extra = component as unknown as Record<string, unknown>;
    return { name: component.name, sku: component.sku ?? '', componentType: component.component_type,
      materialRate: String(component.default_material_rate ?? 0), labourRate: String(component.default_labour_rate ?? 0),
      wasteAmount: String(component.default_waste_type === 'percent' ? component.default_waste_percent ?? 0 : component.default_waste_fixed ?? 0),
      pitchType: component.default_pitch_type, eligibleForOrders: component.eligible_for_orders ?? true,
      storedStrategy: (extra.pricing_strategy as PricingStrategy) ?? 'per_unit',
      storedPackPrice: String(extra.pack_price ?? ''), storedPackSize: String(extra.pack_size ?? ''), storedPackCoverage: String(extra.pack_coverage_m2 ?? ''),
      storedHeightMm: String(extra.height_value_mm ?? ''), storedDepthMm: String(extra.depth_value_mm ?? '') };
  }
  const editorInitial: ComponentEditorInitial = editingComponent ? initialForComponent(editingComponent) : createDefaults ?? {
    name: restoredName, sku: '', componentType: filter === 'extra' ? 'extra' : 'main', materialRate: restoredMaterialRate,
    labourRate: restoredLabourRate, wasteAmount: restoredWasteAmount, pitchType: 'rafter', eligibleForOrders: true };
  const editorSettings: ComponentEditorSettings = { measurementType: formMeasurementType, wasteType: formWasteType,
    pitchEnabled: formPitchEnabled, pricingStrategy: formPricingStrategy, packPrice: formPackPrice, packSize: formPackSize,
    packCoverage: formPackCoverageM2, heightMm: formHeightMm, depthMm: formDepthMm, hoursUnit: formHoursUnit,
    wasteUnit: formWasteUnit, notes: formNotes };
  function updateEditorSettings(patch: Partial<ComponentEditorSettings>) {
    setEditorDirty(true); setDraftTested(false);
    if (patch.measurementType !== undefined) setFormMeasurementType(patch.measurementType);
    if (patch.wasteType !== undefined) setFormWasteType(patch.wasteType);
    if (patch.pitchEnabled !== undefined) setFormPitchEnabled(patch.pitchEnabled);
    if (patch.pricingStrategy !== undefined) setFormPricingStrategy(patch.pricingStrategy);
    if (patch.packPrice !== undefined) setFormPackPrice(patch.packPrice);
    if (patch.packSize !== undefined) setFormPackSize(patch.packSize);
    if (patch.packCoverage !== undefined) setFormPackCoverageM2(patch.packCoverage);
    if (patch.heightMm !== undefined) setFormHeightMm(patch.heightMm);
    if (patch.depthMm !== undefined) setFormDepthMm(patch.depthMm);
    if (patch.hoursUnit !== undefined) setFormHoursUnit(patch.hoursUnit);
    if (patch.wasteUnit !== undefined) setFormWasteUnit(patch.wasteUnit);
    if (patch.notes !== undefined) setFormNotes(patch.notes);
  }
  async function startNew(copy?: ComponentEditorInitial) {
    // Explicitly making a copy preserves its draft values. Other navigation is
    // confirmed first; never save implicitly or bypass subscription/cap guards.
    if (!copy && !(await mayLeaveEditor())) return;
    setEditingId(null); setShowForm(true); setFormError(null); setEditorDirty(!!copy); setDraftTested(false);
    setCreateDefaults(copy ?? null); setEditorVersion(value => value + 1); setTestOnOpen(false); setTestRequest(0);
    // A copied legacy row is a NEW record: use the canonical linear enum.
    if (copy && formMeasurementType === 'linear') setFormMeasurementType('lineal');
    if (!copy) {
      setFormMeasurementType('area'); setFormWasteType('none'); setFormPitchEnabled(false);
      setFormPricingStrategy('per_unit'); setFormPackPrice(''); setFormPackSize(''); setFormPackCoverageM2('');
      setFormHeightMm(''); setFormDepthMm(''); setFormHoursUnit('hr'); setFormWasteUnit('percent'); setFormNotes('');
      setAssignedFlashings([]); setSelectedFlashingId('');
      setRestoredName(''); setRestoredMaterialRate(''); setRestoredLabourRate(''); setRestoredWasteAmount('');
      setSelectedCollectionId(activeLibraryId || collections.find(c => c.is_bootstrap)?.id || collections[0]?.id || '');
    }
  }
  function componentCostSummary(component: ComponentLibraryRow) {
    const values = initialForComponent(component);
    if (values.storedStrategy && values.storedStrategy !== 'per_unit') {
      if (!values.storedPackPrice || !(values.storedStrategy === 'per_pack_coverage' ? values.storedPackCoverage : values.storedPackSize)) return 'Materials: complete the pack settings';
      return `Materials: ${formatCurrency(Number(values.storedPackPrice || 0), companyCurrency)} per pack (${values.storedStrategy === 'per_pack_coverage' ? values.storedPackCoverage : values.storedPackSize} ${canonicalUnit(component.measurement_type)})`;
    }
    return `Materials: ${formatCurrency(component.default_material_rate ?? 0, companyCurrency)}/${canonicalUnit(component.measurement_type)}`;
  }
  useEffect(() => {
    if (showForm || editingId) editorAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [showForm, editingId, editorVersion]);
  useEffect(() => {
    if (!editorDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editorDirty]);

  return (
    <QcLibrary className="space-y-5">
      {feedback}
      {notice}
      {/* Create Library Modal */}
      {showCreateLibraryModal && (
        <QcJourneyDialog label="Create New Library" size="sm">
          <div className="p-6 w-full">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Create New Library</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Library Name</label>
                <input aria-label="Library Name"
                  type="text"
                  value={newLibraryName}
                  onChange={e => setNewLibraryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateLibrary(); } }}
                  placeholder="e.g. Residential, Commercial"
                  maxLength={80}
                  className="qc-input qc-library-control w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              {createLibraryError && (
                <p className="text-xs text-red-600">{createLibraryError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button data-qc-variant="primary"
                  type="button"
                  onClick={() => void handleCreateLibrary()}
                  disabled={creatingLibrary || !newLibraryName.trim()}
                  className="qc-button qc-flow-control qc-library-control flex-1"
                >
                  {creatingLibrary ? 'Creating...' : 'Create Library'}
                </button>
                <button data-qc-variant="ghost"
                  type="button"
                  onClick={() => { setShowCreateLibraryModal(false); setNewLibraryName(''); setCreateLibraryError(''); }}
                  className="qc-button qc-flow-control qc-library-control "
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      {/* Header */}
      <div>
        <h1 className="qc-library-title text-xl md:text-2xl font-semibold text-slate-900">Pricing library</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">Find and reuse Smart Components™: saved materials, labour and measurement settings for your quotes.</p>
      </div>
      <PricingIntroduction open={learning} onOpen={() => setLearning(true)} onDismiss={() => setLearning(false)}
        hasComponents={components.length > 0} tested={testedInSession} created={createdInSession} ownTested={ownTested}
        workspaceSlug={workspaceSlug} onCreate={() => { void startNew(); }}
        onTestCreated={() => {
          const created = components.find(component => component.id === lastCreatedId);
          if (created) void startEdit(created, true);
          else void startNew();
        }}
        onChoose={() => {
          setFilter('all'); setMeasurementFilter('all'); setSearchQuery(''); setActiveLibraryId('');
          requestAnimationFrame(() => document.getElementById('qc-pricing-component-list')?.scrollIntoView({ block: 'start', behavior: 'auto' }));
        }} />


      

      {/* Active library title + rename */}
      {collections.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-1">
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
                className="qc-input qc-library-control px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                autoFocus
              />
              <button data-qc-variant="primary"
                type="button"
                onClick={() => void handleRenameLibrary()}
                disabled={renaming || !renameValue.trim()}
                className="qc-button qc-flow-control qc-library-control "
              >
                {renaming ? 'Saving...' : 'Save'}
              </button>
              <button data-qc-variant="ghost"
                type="button"
                onClick={() => { setRenamingLibraryId(null); setRenameValue(''); }}
                className="qc-button qc-flow-control qc-library-control "
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
              {activeLibraryId && isSupplier && (() => {
                const col = collections.find(c => c.id === activeLibraryId);
                const vis = col?.visibility ?? 'private';
                return (
                  <>
                    {vis === 'published' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Published
                      </span>
                    )}
                    {vis === 'unlisted' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Unlisted
                      </span>
                    )}
                    <button data-qc-variant="ghost"
                      type="button"
                      onClick={() => setShowPublishModal(activeLibraryId)}
                      className="qc-button qc-flow-control qc-library-control "
                    >
                      {vis === 'private' ? 'Publish' : 'Settings'}
                    </button>
                  </>
                );
              })()}
              {activeLibraryId && (
                <>
                  <button aria-label="Rename library" data-qc-variant="ghost"
                    type="button"
                    title="Rename library"
                    onClick={() => {
                      const col = collections.find(c => c.id === activeLibraryId);
                      if (col) { setRenamingLibraryId(activeLibraryId); setRenameValue(col.name); }
                    }}
                    className="qc-button qc-flow-control qc-library-control "
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {!collections.find(c => c.id === activeLibraryId)?.is_bootstrap && (
                    <button aria-label="Delete library" data-qc-variant="ghost"
                      type="button"
                      title="Delete library"
                      onClick={() => setDeletingLibraryId(activeLibraryId)}
                      className="qc-button qc-flow-control qc-library-control "
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit max-w-full">
          {(['all', 'main', 'extra'] as const).map((f) => (
            <button
              key={f}
              aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={"qc-flow-control qc-library-choice " + (`px-4 py-1.5 text-sm rounded-full font-medium transition whitespace-nowrap ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`)}
            >
              {f === 'all' ? 'All' : f === 'main' ? 'Main' : 'Extras'}
            </button>
          ))}
          {/* Owner 2026-09-29: Supplier Directory tab hidden on the pricing
              library page for now. Re-add the Link here when the supplier
              feature returns. */}
        </div>
        
        <div className="flex flex-col gap-2 md:flex-row">
          <button data-qc-variant="primary"
            onClick={() => { void startNew(); }}
            data-copilot="add-component"
            className="qc-button qc-flow-control qc-library-control inline-flex justify-center"
          >
            + Create component
          </button>
          <button data-qc-variant="ghost"
            onClick={() => {
              void mayLeaveEditor().then(leave => { if (leave) { cancelEdit(); setShowCatalogModal(true); } });
            }}
            className="qc-button qc-flow-control qc-library-control inline-flex justify-center"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Add from catalogue
          </button>
          {/* Owner 2026-09-29: Flashings entry button hidden on the pricing
              library page for now, along with its upgrade modal and plan gate. */}
        </div>
      </div>

      {/* Measurement type filters */}
      <div className="qc-library-filters" role="group" aria-label="Filter by measurement">
        {[
          { key: 'all', label: 'All Types' },
          { key: 'area', label: 'Area' },
          { key: 'lineal', label: 'Linear' },
          { key: 'rafter', label: 'Rafter Pitch' },
          { key: 'valley_hip', label: 'Hip/Valley Pitch' },
        ].map(f => (
          <button
            key={f.key}
            aria-pressed={measurementFilter === f.key} onClick={() => setMeasurementFilter(f.key as any)}
            className={"qc-flow-control qc-library-choice " + (`px-3 py-1 text-xs font-medium rounded-full border transition whitespace-nowrap ${
              measurementFilter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Library filter + Search row */}
      <div className="qc-library-search-bar flex items-center gap-3 flex-wrap">
        {collections.length > 0 && (
          <div className="qc-library-library-picker flex items-center gap-2">
            <select aria-label="Component library"
              value={activeLibraryId}
              onChange={e => setActiveLibraryId(e.target.value)}
              className="qc-select qc-library-control px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
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
              <button aria-label={savedDefaultLibId === activeLibraryId ? 'This is your default library' : 'Set as default library'}
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
                className={"qc-flow-control qc-library-choice " + (`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  savedDefaultLibId === activeLibraryId
                    ? 'bg-orange-50 border-orange-300 text-orange-600 hover:bg-orange-100'
                    : 'bg-white border-slate-300 text-slate-500 hover:border-orange-300 hover:text-orange-500'
                }`)}
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
        <div className="qc-library-component-search relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search components" placeholder="Search components…"
            className="qc-input qc-flow-search qc-library-control w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button type="button" aria-label="Clear component search" data-qc-variant="ghost" onClick={() => setSearchQuery('')} className="qc-button qc-flow-control qc-library-control qc-search-clear">&times;</button>
          )}
        </div>
      </div>

      <div ref={editorAnchor} className="qc-pricing-editor-anchor">
        {(showForm || editingComponent) && (
          <SmartComponentEditor key={`${editingId ?? 'new'}-${editorVersion}`}
            mode={editingComponent ? 'edit' : 'create'} initial={editorInitial} settings={editorSettings}
            onSettingsChange={updateEditorSettings} measurementSystem={companyMeasurementSystem} currency={companyCurrency}
            genericTradesEnabled={genericTradesEnabled} pitchVisible={pitchVisible} pitchHidesValleyHip={pitchHidesValleyHip}
            pitchRafterLabel={pitchRafterLabel} pitchCheckboxLabel={pitchCheckboxLabel}
            collections={collections} selectedCollectionId={selectedCollectionId}
            onCollectionChange={value => { setEditorDirty(true); if (value === '__create_new__') setShowCreateLibraryModal(true); else setSelectedCollectionId(value); }}
            flashings={flashings} assignedFlashings={assignedFlashings} selectedFlashingId={selectedFlashingId}
            onFlashingSelection={setSelectedFlashingId} onAddFlashing={addFlashing} onRemoveFlashing={removeFlashing}
            imageHelperText={imageHelperText} supplierSkuRequired={!!(isSupplier && collections.find(c => c.id === activeLibraryId)?.visibility === 'published')}
            saving={saving} error={formError} onSubmit={editingComponent ? event => handleUpdate(event, editingComponent.id) : handleCreate}
            onCancel={() => { void mayLeaveEditor().then(leave => { if (leave) cancelEdit(); }); }}
            onDirty={() => { setEditorDirty(true); setDraftTested(false); }} onCalculated={() => {
            void demoComponentCalculated(editingId);
              setTestedInSession(true);
              if (showForm) setDraftTested(true);
              if (editingId && editingId === lastCreatedId) setOwnTested(true);
            }}
            onCopy={copy => { void startNew(copy); }} openTestInitially={testOnOpen} testRequest={testRequest} learning={learning}
          />
        )}
      </div>

      <div id="qc-pricing-component-list" className="space-y-2">
        {filtered.map((comp) => (
          <div key={comp.id}>

              <div
                id={`component-row-${comp.id}`}
                onClick={() => startEdit(comp)}
                title="Click to view component"
                className={`qc-component-row px-4 py-3 border rounded-xl cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group ${
                  highlightId === comp.id
                    ? 'border-orange-300 bg-orange-50 shadow-[0_0_12px_rgba(255,107,53,0.25)]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="qc-component-row-meta">
                    <h3 className="font-medium text-slate-900"><button type="button" className="qc-library-action-name" onClick={(event) => { event.stopPropagation(); startEdit(comp); }}>{comp.name}</button></h3>
                    {comp.sku && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">{comp.sku}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comp.component_type === 'main' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                      {comp.component_type}
                    </span>
                    <span className="text-xs text-slate-400">{MEASUREMENT_LABELS[comp.measurement_type]}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {componentCostSummary(comp)} · Labour: {formatCurrency(comp.default_labour_rate ?? 0, companyCurrency)}/{canonicalUnit(comp.measurement_type)}
                    {comp.default_waste_type !== 'none' && (
                      <> · Waste: {comp.default_waste_type === 'percent' ? `${comp.default_waste_percent}%` : `${comp.default_waste_fixed} ${canonicalUnit(comp.measurement_type)}`}</>
                    )}
                    {comp.default_pitch_type !== 'none' && <> · {PITCH_LABELS[comp.default_pitch_type]}</>}
                  </p>
                  {(comp as unknown as { notes?: string | null }).notes && (
                    <p className="text-xs text-slate-400 italic mt-1 line-clamp-1">
                      {(comp as unknown as { notes?: string | null }).notes}
                    </p>
                  )}
                </div>
                <div className="qc-component-row-actions">
                {/* The existing actions stay visible on touch and keyboard. */}
                <button aria-label={`Open and test ${comp.name}`} data-qc-variant="ghost"
                  onClick={(e) => { e.stopPropagation(); void startEdit(comp, true); }}
                  title="Open and test this component"
                  className="qc-button qc-flow-control qc-library-control "
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Open & test
                </button>
                <button aria-label={`Delete ${comp.name}`} data-qc-variant="ghost" 
                  onClick={(e) => { e.stopPropagation(); setDeleteCompId(comp.id); }} 
                  title="Click to delete"
                  className="qc-button qc-flow-control qc-library-control "
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                </div>
              </div>
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteCompId && (
        <QcJourneyDialog label="Delete Smart Component™" size="sm">
          <div className="p-4 md:p-6 w-full">
            <h3 className="text-lg font-semibold text-slate-900">Delete Smart Component™</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The Smart Component™ will be removed from your library.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button data-qc-variant="ghost" onClick={() => setDeleteCompId(null)} className="qc-button qc-flow-control qc-library-control " disabled={deleteLoading}>Cancel</button>
              <button data-qc-variant="danger" onClick={confirmDeleteComp} className="qc-button qc-flow-control qc-library-control " disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      {/* Delete Library Confirm Modal */}
      {deletingLibraryId && (
        <QcJourneyDialog label="Delete Library" size="sm">
          <div className="p-4 md:p-6 w-full">
            <h3 className="text-lg font-semibold text-slate-900">Delete Library</h3>
            <p className="text-sm text-slate-500 mt-2">
              Deleting this library will delete all components inside it. Move any components you want to keep to another library first, or delete them forever here.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button data-qc-variant="ghost"
                onClick={() => setDeletingLibraryId(null)}
                disabled={deleteLibraryLoading}
                className="qc-button qc-flow-control qc-library-control "
              >
                Cancel
              </button>
              <button data-qc-variant="danger"
                onClick={() => void handleDeleteLibrary()}
                disabled={deleteLibraryLoading}
                className="qc-button qc-flow-control qc-library-control "
              >
                {deleteLibraryLoading ? 'Deleting...' : 'Delete Library'}
              </button>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      {/* Component Edit Warning Modal */}
      {editWarningOpen && (
        <QcJourneyDialog label="Heads up before saving" size="sm">
          <div className="p-4 md:p-6 w-full">
            <h3 className="text-lg font-semibold text-slate-900">Heads up before saving</h3>
            <p className="text-sm text-slate-500 mt-2">
              Beware: edited changes will only affect new component entries moving forward, not previously saved component entries.
            </p>
            <label className="flex items-center gap-2 mt-4 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={editWarningDontShow}
                onChange={(e) => setEditWarningDontShow(e.target.checked)}
                className="qc-checkbox qc-library-control h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              Don’t show me this warning anymore
            </label>
            <div className="flex gap-3 justify-end mt-6">
              <button data-qc-variant="ghost"
                type="button"
                onClick={() => {
                  setEditWarningOpen(false);
                  setPendingUpdateData(null);
                }}
                className="qc-button qc-flow-control qc-library-control "
              >
                Cancel
              </button>
              <button data-qc-variant="primary"
                type="button"
                onClick={() => void handleConfirmEditWarning()}
                disabled={saving}
                className="qc-button qc-flow-control qc-library-control "
              >
                {saving ? 'Saving...' : 'Confirm and Save'}
              </button>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      {/* Publish Library Modal (supplier-only) */}
      {showPublishModal && isSupplier && (() => {
        const col = collections.find(c => c.id === showPublishModal);
        if (!col) return null;
        return <PublishLibraryModal
          collectionId={col.id}
          collectionName={col.name}
          currentVisibility={(col.visibility ?? 'private') as 'private' | 'unlisted' | 'published'}
          publicTitle={col.public_title ?? ''}
          publicDescription={col.public_description ?? ''}
          roofingTypes={col.roofing_types ?? []}
          onClose={() => setShowPublishModal(null)}
          onSaved={async () => {
            setShowPublishModal(null);
            // Reload collections by re-fetching the page data
            window.location.reload();
          }}
        />;
      })()}

      {/* Add from Catalog Modal */}
      {showCatalogModal && (
        <AddFromCatalogModal
          workspaceSlug={workspaceSlug}
          collections={collections.map(c => ({
            id: c.id,
            name: c.name,
            is_bootstrap: c.is_bootstrap,
            component_count: undefined,
          }))}
          onClose={() => {
            setShowCatalogModal(false);
            // Only refresh after the user has read the confirmed import result.
            // Opening import is dirty-guarded; no active draft is discarded.
            if (catalogueChanged) window.location.assign(`/${workspaceSlug}/components?reviewImport=1`);
          }}
          onCreated={() => setCatalogueChanged(true)}
        />
      )}
    </QcLibrary>
  );
}

/**
 * Type-specific dimension fields shown only when the generic-trades flag is on.
 * Handles measurement types that need extra configuration: height for
 * length_x_height, depth for volume, time-unit for hours_days.
 * Pricing strategy and waste interpretation are now inline in the main form.
 */
