'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { MaterialOrderTemplateRow, FlashingLibraryRow } from '@/app/lib/types';
import { saveDraftOrder } from './order-actions';
import type { QuoteData } from './quote-loader';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import {
  convertLinear,
  convertArea,
  convertAreaFt2,
} from '@/app/lib/measurements/conversions';
import type { ExistingOrderData } from './order-loader';
import type { LineByLineData } from '../lineByLine';
import { BackButton } from '@/app/components/BackButton';
import { AlertModal } from '@/app/components/AlertModal';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';
import { CatalogSearchModal } from '../../quotes/[id]/customer-edit/CatalogSearchModal';
import { AngleCalculatorWidget } from '../../flashings/draw/AngleCalculatorWidget';
import { OrderLineByLineEditor } from './OrderLineByLineEditor';
import { SearchableFlashingSelect } from '@/app/components/SearchableFlashingSelect';
import { CollapseButton, ExpandTab } from '@/app/components/editor/CollapsiblePanel';
import {
  parseLineByLineData,
  parseLineByLineFooter,
  parseLineByLineTaxes,
  parseLineByLineHideAllPrices,
  parseLineByLineHideTotals,
  type LineByLineItem,
  type LineByLineTax,
} from '../lineByLine';

/** Minimal component-library option for the order item picker. */
interface ComponentOption {
  id: string;
  name: string;
  /** Named library (component_collections.id) this component belongs to. Null = unfiled. */
  collection_id?: string | null;
}

/** Named component library for the add-component library selector. */
interface ComponentCollection {
  id: string;
  name: string;
}

/** Sentinel for the "All components" option in the library selector. */
const ALL_LIBRARIES = '__all__';

interface OrderCreateFormProps {
  templates: MaterialOrderTemplateRow[];
  flashings: FlashingLibraryRow[];
  /** Company component library, for the "add from library" dropdown in the item modal. */
  components?: ComponentOption[];
  /** Named component libraries for the add-component library selector. */
  collections?: ComponentCollection[];
  /** Workspace slug, needed by the catalog search modal endpoint. */
  workspaceSlug?: string;
  quoteData?: QuoteData | null;
  existingOrder?: ExistingOrderData | null;
  /** When true the company is over storage - block logo upload. */
  isOverStorage?: boolean;
  /** Layout family chosen up front (orders hub picker) and locked for this
   *  order. 'line_by_line' = customer-quote-style editor; 'components' (default)
   *  = the Components + Images editor with single/double toggle. */
  initialLayout?: 'line_by_line' | 'components';
  /** Initial column mode for the Components editor (from the picker / saved
   *  order). The user can still toggle single<->double inside the editor. */
  initialColumn?: 'single' | 'double';
  /** Company currency code, for line-by-line price rendering. */
  currency?: string;
  /** Full company component library, for the line-by-line "Add a component" picker. */
  componentLibrary?: { id: string; name: string; collection_id: string | null }[];
  /** Active company default taxes, for the line-by-line optional-tax picker. */
  companyTaxes?: { id: string; name: string; rate_percent: number }[];
  /** Catalogs for the line-by-line Add Line Item modal. */
  catalogs?: { id: string; name: string }[];
  /** Decision #4: pre-built line-by-line envelope when creating a NEW order from
   *  a quote in the line-by-line layout. Mirrors the customer quote editor's
   *  priced lines + footer + taxes. Null for blank/custom + existing-order edits. */
  initialLineByLine?: LineByLineData | null;
  /** Company default measurement system - drives metric vs imperial unit options
   *  in the Add/Edit Order Item modal. Quote-linked orders override with the
   *  quote's system when present. */
  companyMeasurementSystem?: string;
}

interface Variable {
  name: string;
  value: number;
  unit: string;
}

interface LengthEntry {
  /** For linear: the length value. For area/volume: the computed total. */
  length: number;
  multiplier: number;
  variables?: Variable[];
  /** Area/Volume optional calculator breakdown (display only). When present the
   *  entry was built from L x W (area) or L x W x D (volume); `length` holds
   *  the resulting total. Absent when the user typed the total directly. */
  calcLength?: number;
  calcWidth?: number;
  calcDepth?: number;
}

/**
 * entryMode: 'single' (qty + optional description), 'linear' (length x qty
 * entries, formerly 'multiple'), 'area' (m2/ft2 entries), 'volume' (m3/ft3).
 * Legacy rows stored 'multiple' - normalised to 'linear' on load.
 */
type OrderEntryMode = 'single' | 'linear' | 'area' | 'volume';

interface OrderLineItem {
  id: string;
  componentName: string;
  flashingId?: string;
  flashingImageUrl?: string;
  entryMode: OrderEntryMode;
  // Single mode
  quantity: number;
  unit: string;
  // Linear / area / volume mode
  lengths?: LengthEntry[];
  lengthUnit?: string;
  // Fixed Quantity display: when the component uses per_pack_* pricing,
  // pricedQuantity is the rounded-up purchasable unit count and
  // measurementDisplay is the human-readable total length/area/volume
  // (e.g. "23.4m" or "12.5m\u00b2"). Rendered as: qty (measurement).
  pricedQuantity?: number;
  measurementDisplay?: string;
  // Common
  notes?: string;
  showComponentName: boolean;
  showFlashingImage: boolean;
  showMeasurements: boolean;
}

export function OrderCreateForm({ templates, flashings, components = [], collections = [], workspaceSlug = '', quoteData, existingOrder, isOverStorage, initialLayout = 'components', initialColumn = 'single', currency = 'GBP', componentLibrary = [], companyTaxes = [], catalogs = [], initialLineByLine = null, companyMeasurementSystem = 'metric' }: OrderCreateFormProps) {
  // Quote-linked orders use the quote's measurement system; manual orders use
  // the company default. This single value drives the modal's metric/imperial
  // unit options so the two systems never mix.
  const effectiveMeasurementSystem = quoteData?.measurement_system ?? companyMeasurementSystem;
  const router = useRouter();
  
  // Layout state
  const [layoutMode, setLayoutMode] = useState<'single' | 'double'>(initialColumn);
  // Line-by-line layout lines (separate from the components `orderLines`).
  // Persisted to `material_orders.line_by_line_data`; hydrated on edit below.
  const isLineByLine = initialLayout === 'line_by_line';
  const [lineByLineLines, setLineByLineLines] = useState<LineByLineItem[]>([]);
  const [lineByLineFooter, setLineByLineFooter] = useState('');
  const [lineByLineTaxes, setLineByLineTaxes] = useState<LineByLineTax[]>([]);
  const [lineByLineHideLinePrices, setLineByLineHideLinePrices] = useState(false);
  const [lineByLineHideTotals, setLineByLineHideTotals] = useState(false);
  const [lineByLineShowQuantityColumn, setLineByLineShowQuantityColumn] = useState(false);
  // App-style alert state. Replaces native alert() calls so the order flow
  // matches the rest of the app's modal styling.
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    variant?: 'info' | 'success' | 'error';
    /** When set, the modal's close handler runs this callback (e.g. navigate after save). */
    onClose?: () => void;
  }>({ open: false, title: '' });
  const showAlert = (
    title: string,
    description?: string,
    variant: 'info' | 'success' | 'error' = 'info',
    onClose?: () => void
  ) => setAlertState({ open: true, title, description, variant, onClose });
  const closeAlert = () => {
    const cb = alertState.onClose;
    setAlertState({ open: false, title: '' });
    if (cb) cb();
  };
  const [headerExpanded, setHeaderExpanded] = useState(true);
  // Declutter: collapse the components control sidebar so the order-form
  // preview fills the space. Pure layout state - sidebar stays mounted.
  const [componentsPanelCollapsed, setComponentsPanelCollapsed] = useState(false);
  // Hover-to-highlight: when the user hovers a component in the left sidebar,
  // the matching card in the order review gets an orange border so they can
  // quickly see which component they need to edit.
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Add item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  // Collapsed sidebar items: quote-derived lines start collapsed for cleaner UX.
  // Stored as a Set of line IDs that are currently collapsed.
  const [collapsedLines, setCollapsedLines] = useState<Set<string>>(new Set());
  // Remove confirmation: id of the line pending removal, null = modal closed.
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  function toggleCollapsed(lineId: string) {
    setCollapsedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }
  
  // Header form state - LEFT
  const [toSupplier, setToSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [orderType, setOrderType] = useState('');
  const [colours, setColours] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Header form state - RIGHT
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [fromCompany, setFromCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Order line items
  const [orderLines, setOrderLines] = useState<OrderLineItem[]>([]);
  
  // Auto-populate from quote data - hydrate ONCE on mount.
  //
  // Same pattern as BlankQuoteBuilder / the customer editor: a single
  // hydratedRef guard so a parent re-render (router.refresh, identical-
  // content prop ref change, RSC revalidation bubbling from elsewhere)
  // can NEVER wipe in-progress edits. The previous `quoteLoaded` state
  // approach worked at first paint but allowed a stale `existingOrder`
  // payload to clobber unsaved form state seconds later - the classic
  // "editor reverted to last saved" bug.
  const hydratedFromQuoteRef = useRef(false);
  useEffect(() => {
    if (hydratedFromQuoteRef.current) return;
    if (!quoteData) return;
    if (quoteData.components.length === 0) return;
    hydratedFromQuoteRef.current = true;
    
    // Components are pre-filtered server-side (create/page.tsx) when coming from
    // the line-selector step. Map everything we receive here.
    const componentsToMap = quoteData.components;

    console.log('[OrderCreateForm] Mapping', componentsToMap.length, 'components');
    
    // The quote's measurement system is locked at creation; the order
    // inherits it. We:
    //   - paint the right unit suffix (m / m² / ft / ft² / RS) into
    //     `unit` and `lengthUnit`
    //   - convert the canonical metric quantities into the display system
    //     so the value the supplier sees matches the quote.
    const sys = normalizeMeasurementSystem(quoteData.measurement_system);
    const lengthUnit = getUnitLabel('lineal', quoteData.measurement_system); // 'm' | 'ft'
    const areaUnit = getUnitLabel('area', quoteData.measurement_system);     // 'm²' | 'ft²' | 'RS'
    const toDisplayLinear = (m: number) => sys === 'metric' ? m : convertLinear(m);
    const toDisplayArea = (sqm: number) => {
      if (sys === 'metric') return sqm;
      if (sys === 'imperial_ft') return convertAreaFt2(sqm);
      return Number(convertArea(sqm)); // imperial_rs -> RS
    };

    // Map quote components to order line items
    const mappedLines: OrderLineItem[] = componentsToMap.map((comp) => {
      // Get first flashing_id from component_library join (flashing_ids is array)
      const flashingId = comp.component_library?.flashing_ids?.[0] || undefined;
      const flashing = flashingId ? flashings.find(f => f.id === flashingId) : undefined;

      // Pick the unit + display value for the SINGLE-quantity path.
      const singleUnit =
        comp.measurement_type === 'lineal'
          ? lengthUnit
          : comp.measurement_type === 'area'
          ? areaUnit
          : 'pcs';
      const rawQty = comp.final_quantity || 0;
      const displayQty =
        comp.measurement_type === 'lineal'
          ? toDisplayLinear(rawQty)
          : comp.measurement_type === 'area'
          ? toDisplayArea(rawQty)
          : rawQty;

      // Fixed Quantity display: when the component uses per_pack_* pricing,
      // priced_quantity is the rounded-up purchasable unit count and
      // final_quantity is the real measured total. Build a human-readable
      // measurement string (e.g. "23.4m" or "12.5m²") for display alongside
      // the quantity.
      const pricedQty = comp.priced_quantity ?? null;
      let measurementDisplay: string | undefined;
      if (pricedQty != null) {
        const mt = comp.measurement_type;
        if (mt === 'lineal') {
          measurementDisplay = `${Math.round(displayQty * 100) / 100}${lengthUnit}`;
        } else if (mt === 'area') {
          measurementDisplay = `${Math.round(displayQty * 100) / 100}${areaUnit}`;
        } else if (mt === 'volume') {
          measurementDisplay = `${Math.round(displayQty * 100) / 100}m³`;
        } else {
          measurementDisplay = `${Math.round(displayQty * 100) / 100} ${singleUnit}`;
        }
      }

      // Check if we have individual measurements for this component
      const hasMeasurements = comp.measurements && comp.measurements.length > 0;

      if (hasMeasurements) {
        // Multiple-entries mode - the stored measurement_values are in
        // canonical metric (m for linear, m² for area), so convert each into
        // the display system before rendering.
        const isLineal = comp.measurement_type === 'lineal';
        const lengths: LengthEntry[] = comp.measurements!.map(m => {
          const converted = isLineal ? toDisplayLinear(m.measurement_value) : toDisplayArea(m.measurement_value);
          return { length: Math.round(converted * 100) / 100, multiplier: 1 };
        });

        // Pick the right unit for the entries: linear unit (m / ft) for
        // lineal components, area unit (m² / ft² / RS) for area components.
        // Anything else (quantity / fixed) falls back to the linear unit
        // since those rarely use the multi-entries mode.
        const entryUnit = comp.measurement_type === 'area' ? areaUnit : lengthUnit;

        return {
          id: `quote-${comp.id}`,
          componentName: comp.name,
          flashingId,
          flashingImageUrl: flashing?.image_url,
          entryMode: 'linear',
          quantity: 0,
          unit: 'pcs',
          lengths,
          lengthUnit: entryUnit,
          pricedQuantity: pricedQty ?? undefined,
          measurementDisplay,
          showComponentName: true,
          showFlashingImage: !!flashing?.image_url,
          showMeasurements: true,
        };
      } else {
        return {
          id: `quote-${comp.id}`,
          componentName: comp.name,
          flashingId,
          flashingImageUrl: flashing?.image_url,
          entryMode: 'single',
          quantity: displayQty,
          unit: singleUnit,
          pricedQuantity: pricedQty ?? undefined,
          measurementDisplay,
          showComponentName: true,
          showFlashingImage: !!flashing?.image_url,
          showMeasurements: true,
        };
      }
    });
    
    console.log('[OrderCreateForm] Setting', mappedLines.length, 'order lines');
    setOrderLines(mappedLines);
    // Collapse all quote-derived lines by default for a cleaner sidebar.
    setCollapsedLines(new Set(mappedLines.map(l => l.id)));
    
    // Pre-fill reference if available
    if (quoteData.quote_number) {
      console.log('[OrderCreateForm] Pre-filling reference:', quoteData.quote_number);
      setReference(`Order for ${quoteData.quote_number}`);
    }
  }, [quoteData, flashings]);
  
  // Load existing order for edit - hydrate ONCE on mount.
  //
  // Critical: do NOT re-run this effect when `existingOrder` reference
  // changes after a router.refresh or a sibling-component revalidation.
  // If we did, the user's unsaved edits would be replaced by the last
  // server-persisted snapshot every few seconds - the "auto-save
  // revert" bug Shaun has flagged across editors. Guard with a ref so
  // the effect short-circuits on every render after the first.
  const hydratedFromExistingRef = useRef(false);
  useEffect(() => {
    if (hydratedFromExistingRef.current) return;
    if (!existingOrder) return;
    hydratedFromExistingRef.current = true;

    console.log('[OrderCreateForm] Loading existing order:', existingOrder.order.order_number);
    
    const { order, lines } = existingOrder;
    
    // Load header fields
    setSelectedTemplateId(order.template_id || '');
    setReference(order.reference || order.job_name || '');
    setToSupplier(order.to_supplier || order.supplier_name || '');
    setFromCompany(order.from_company || '');
    setContactPerson(order.contact_person || order.supplier_contact || '');
    setContactDetails(order.contact_details || '');
    setOrderType(order.order_type || '');
    setColours(order.colours || (order.job_colours || []).join(', '));
    setDeliveryDate(order.delivery_date || '');
    setDeliveryAddress(order.delivery_address || '');
    setOrderNotes(order.header_notes || '');
    setLogoUrl(order.logo_url || '');
    setOrderDate(order.order_date || new Date().toISOString().split('T')[0]);
    // `layout_mode` and `entry_mode` are stored as plain text (nullable)
    // at the DB level; coerce into the narrow client-side union so the
    // rendered UI doesn't receive unexpected values.
    setLayoutMode(order.layout_mode === 'double' ? 'double' : 'single');

    // Line-by-line orders store their items in `line_by_line_data`; hydrate
    // those here (the components `orderLines` path below stays empty for them).
    if (order.layout_mode === 'line_by_line') {
      setLineByLineLines(parseLineByLineData(order.line_by_line_data));
      setLineByLineFooter(parseLineByLineFooter(order.line_by_line_data));
      setLineByLineTaxes(parseLineByLineTaxes(order.line_by_line_data));
      setLineByLineHideLinePrices(parseLineByLineHideAllPrices(order.line_by_line_data));
      setLineByLineHideTotals(parseLineByLineHideTotals(order.line_by_line_data));
    }

    // Map line items
    const mappedLines: OrderLineItem[] = lines.map(line => ({
      id: line.id,
      componentName: line.item_name,
      flashingId: line.flashing_id || undefined,
      flashingImageUrl: line.flashing_image_url || undefined,
      // Legacy rows stored 'multiple' for the old multi-length mode -> 'linear'.
      entryMode: ((): OrderEntryMode => {
        const m = line.entry_mode;
        if (m === 'area' || m === 'volume' || m === 'linear') return m;
        if (m === 'multiple') return 'linear';
        return 'single';
      })(),
      quantity: line.quantity || 0,
      unit: line.unit || 'pcs',
      // `lengths` is JSONB on the DB; our app writes LengthEntry[] into it.
      // Cast via unknown for the type bridge.
      lengths: (line.lengths as unknown as LengthEntry[] | null) || undefined,
      lengthUnit: line.length_unit || undefined,
      notes: line.item_notes || undefined,
      // The DB columns are nullable; the form treats null as false (the
      // checkbox unchecked state).
      showComponentName: line.show_component_name ?? false,
      showFlashingImage: line.show_flashing_image ?? false,
      showMeasurements: line.show_measurements ?? false,
      pricedQuantity: line.priced_quantity ?? undefined,
      measurementDisplay: line.measurement_display ?? undefined,
    }));
    
    console.log('[OrderCreateForm] Loaded', mappedLines.length, 'line items');
    setOrderLines(mappedLines);
    // Collapse all existing-order lines by default for a cleaner sidebar.
    setCollapsedLines(new Set(mappedLines.map(l => l.id)));
  }, [existingOrder]);

  // Decision #4: hydrate the line-by-line editor from a quote-derived envelope
  // when creating a NEW line-by-line order from a quote. Ref-guarded ONCE on
  // mount (same anti-clobber pattern as the other hydrators) so a parent
  // re-render can never wipe in-progress edits. Only fires when initialLineByLine
  // is present (line-by-line + quoteId + no existingOrder); the custom blank
  // line-by-line path passes null and is untouched.
  const hydratedFromQuoteLblRef = useRef(false);
  useEffect(() => {
    if (hydratedFromQuoteLblRef.current) return;
    if (!initialLineByLine) return;
    if (initialLayout !== 'line_by_line') return;
    hydratedFromQuoteLblRef.current = true;

    setLineByLineLines(initialLineByLine.lines);
    setLineByLineFooter(initialLineByLine.footer);
    setLineByLineTaxes(initialLineByLine.taxes);
    setLineByLineHideLinePrices(initialLineByLine.hideLinePrices);
    setLineByLineHideTotals(initialLineByLine.hideTotals);

    // Pre-fill the reference the same way the components quote path does.
    if (quoteData?.quote_number) {
      setReference((prev) => prev || `Order for ${quoteData.quote_number}`);
    }
  }, [initialLineByLine, initialLayout, quoteData]);
  
  // Template auto-fill
  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    
    if (!templateId) {
      setToSupplier('');
      setFromCompany('');
      setContactPerson('');
      setContactDetails('');
      setDeliveryAddress('');
      setOrderNotes('');
      setLogoUrl('');
      setReference('');
      setOrderType('');
      setColours('');
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    if (template.default_supplier_name) setToSupplier(template.default_supplier_name);
    if (template.default_from_company) setFromCompany(template.default_from_company);
    if (template.default_contact_person) setContactPerson(template.default_contact_person);
    if (template.default_contact_details) setContactDetails(template.default_contact_details);
    if (template.default_delivery_address) setDeliveryAddress(template.default_delivery_address);
    if (template.default_header_notes) setOrderNotes(template.default_header_notes);
    if (template.default_logo_url) setLogoUrl(template.default_logo_url);
    if (template.default_reference) setReference(template.default_reference);
    if (template.default_order_type) setOrderType(template.default_order_type);
    if (template.default_colours) setColours(template.default_colours.join(', '));
  }
  
  
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (isOverStorage) { setStorageBlocked(true); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showAlert('Image required', 'Please upload an image file.', 'info');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert('Image too large', 'The image must be less than 5 MB.', 'info');
      return;
    }
    
    setUploadingLogo(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const { url } = await response.json();
      setLogoUrl(url);
    } catch (error) {
      console.error('Logo upload error:', error);
      const message = error instanceof Error ? error.message : 'Please try again.';
      showAlert('Failed to upload logo', message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  }
  
  function openAddItemModal() {
    setEditingLineId(null);
    setShowAddItemModal(true);
  }
  
  function openEditModal(lineId: string) {
    setEditingLineId(lineId);
    setShowAddItemModal(true);
  }
  
  function saveLineItem(data: {
    componentName: string;
    flashingId?: string;
    entryMode: OrderEntryMode;
    quantity?: number;
    unit?: string;
    lengths?: LengthEntry[];
    lengthUnit?: string;
    notes?: string;
    pricedQuantity?: number;
    measurementDisplay?: string;
  }) {
    const flashing = data.flashingId ? flashings.find(f => f.id === data.flashingId) : undefined;
    
    if (editingLineId) {
      // Update existing
      setOrderLines(orderLines.map(line => 
        line.id === editingLineId
          ? {
              ...line,
              componentName: data.componentName,
              flashingId: data.flashingId,
              flashingImageUrl: flashing?.image_url,
              // BUGFIX: spreading ...line preserved the OLD show_flashing_image
              // (false for lines created without an image), so newly-added
              // images never rendered in the preview/sent order after an edit.
              // Drive it from whether an image is actually attached now.
              showFlashingImage: !!flashing?.image_url,
              entryMode: data.entryMode,
              quantity: data.quantity || 0,
              unit: data.unit || '',
              lengths: data.lengths,
              lengthUnit: data.lengthUnit,
              notes: data.notes,
              pricedQuantity: data.pricedQuantity,
              measurementDisplay: data.measurementDisplay,
            }
          : line
      ));
    } else {
      // Add new
      const newLine: OrderLineItem = {
        id: `line-${Date.now()}`,
        componentName: data.componentName,
        flashingId: data.flashingId,
        flashingImageUrl: flashing?.image_url,
        entryMode: data.entryMode,
        quantity: data.quantity || 0,
        unit: data.unit || '',
        lengths: data.lengths,
        lengthUnit: data.lengthUnit,
        notes: data.notes,
        pricedQuantity: data.pricedQuantity,
        measurementDisplay: data.measurementDisplay,
        showComponentName: true,
        showFlashingImage: true,
        showMeasurements: true,
      };
      setOrderLines([...orderLines, newLine]);
    }
    
    setShowAddItemModal(false);
    setEditingLineId(null);
  }
  
  function removeLine(id: string) {
    // Open the app-style ConfirmModal instead of native confirm().
    setRemoveConfirmId(id);
  }
  function confirmRemoveLine() {
    if (removeConfirmId) setOrderLines(orderLines.filter(l => l.id !== removeConfirmId));
    setRemoveConfirmId(null);
  }
  
  function toggleLineVisibility(lineId: string, field: 'showComponentName' | 'showFlashingImage' | 'showMeasurements') {
    setOrderLines(orderLines.map(line =>
      line.id === lineId ? { ...line, [field]: !line[field] } : line
    ));
  }
  
  function moveLineUp(lineId: string) {
    const index = orderLines.findIndex(l => l.id === lineId);
    if (index <= 0) return;
    
    const newLines = [...orderLines];
    [newLines[index - 1], newLines[index]] = [newLines[index], newLines[index - 1]];
    setOrderLines(newLines);
  }
  
  function moveLineDown(lineId: string) {
    const index = orderLines.findIndex(l => l.id === lineId);
    if (index < 0 || index >= orderLines.length - 1) return;
    
    const newLines = [...orderLines];
    [newLines[index], newLines[index + 1]] = [newLines[index + 1], newLines[index]];
    setOrderLines(newLines);
  }
  
  async function handleSaveDraft() {
    if (!reference.trim()) {
      showAlert('Reference required', 'Please enter a Reference / Job name before saving.', 'info');
      return;
    }

    if (isLineByLine) {
      if (lineByLineLines.length === 0) {
        showAlert('No lines', 'Please add at least one line before saving.', 'info');
        return;
      }
    } else if (orderLines.length === 0) {
      showAlert('No components', 'Please add at least one component before saving.', 'info');
      return;
    }
    
    setSaving(true);
    
    try {
      const result = await saveDraftOrder({
        orderId: existingOrder?.order.id,
        templateId: selectedTemplateId || undefined,
        reference: reference.trim(),
        toSupplier,
        fromCompany,
        contactPerson,
        contactDetails,
        orderType,
        colours,
        deliveryDate,
        deliveryAddress,
        orderNotes,
        logoUrl,
        orderDate,
        layoutMode: isLineByLine ? 'line_by_line' : layoutMode,
        lineByLineData: isLineByLine
          ? {
              lines: lineByLineLines,
              footer: lineByLineFooter,
              taxes: lineByLineTaxes,
              hideLinePrices: lineByLineHideLinePrices,
              hideTotals: lineByLineHideTotals,
              showQuantityColumn: lineByLineShowQuantityColumn,
            }
          : undefined,
        lineItems: isLineByLine ? [] : orderLines.map((line, index) => ({
          componentName: line.componentName,
          flashingId: line.flashingId,
          flashingImageUrl: line.flashingImageUrl,
          entryMode: line.entryMode,
          quantity: line.quantity,
          unit: line.unit,
          lengths: line.lengths,
          lengthUnit: line.lengthUnit,
          notes: line.notes,
          showComponentName: line.showComponentName,
          showFlashingImage: line.showFlashingImage,
          showMeasurements: line.showMeasurements,
          pricedQuantity: line.pricedQuantity,
          measurementDisplay: line.measurementDisplay,
          sortOrder: index,
        })),
      });
      
      // Show success modal, then navigate when the user closes it. The
      // navigation runs in the modal's onClose so the user actually sees the
      // confirmation instead of being whisked away mid-toast.
      showAlert(
        'Order saved',
        `Order #${result.orderNumber} has been saved successfully.`,
        'success',
        () => router.push('../material-orders')
      );
    } catch (error) {
      console.error('Save error:', error);
      const message = error instanceof Error ? error.message : 'Please try again.';
      showAlert('Failed to save order', message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // Shared order header (template selector + To/From two-column form + minimize).
  // Used by BOTH the components editor and the line-by-line editor so they
  // share one identical header system (Shaun: line-by-line must use the same
  // header as the single/double column flow).
  // `rounded` = line-by-line variant: render the header as a rounded card
  // (matches the rest of the app) instead of the full-bleed square header the
  // components editor uses. Components editor calls this with no arg (false).
  function renderOrderHeader(rounded = false) {
    return (
      <div className={rounded ? 'flex-shrink-0 px-6 pt-4' : 'flex-shrink-0'}>
        {headerExpanded ? (
          <div
            className={
              rounded
                ? 'bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden'
                : 'bg-white border-b border-slate-200 shadow-sm'
            }
          >
            {/* Template Selector */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50" data-copilot="mo-template">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Use Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">None - Enter details manually</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.description && `- ${template.description}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Header Form - Two Column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6" data-copilot="mo-header-form">
              {/* LEFT COLUMN */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To (Supplier)</h3>
                <input type="text" value={toSupplier} onChange={(e) => setToSupplier(e.target.value)} placeholder="To" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="text" value={orderType} onChange={(e) => setOrderType(e.target.value)} placeholder="Order Type (optional)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="text" value={colours} onChange={(e) => setColours(e.target.value)} placeholder="Colours" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} placeholder="Delivery Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery Address" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Order Notes" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From (Your Company)</h3>
                <div className="flex items-start gap-3">
                  {logoUrl ? (
                    <div className="relative w-20 h-20 border border-slate-200 rounded bg-white">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      <button type="button" onClick={() => setLogoUrl('')} className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
                      <span className="text-xs text-slate-400">Logo</span>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50">
                      {uploadingLogo ? 'Uploading...' : 'Upload'}
                    </span>
                  </label>
                </div>
                <input type="text" value={fromCompany} onChange={(e) => setFromCompany(e.target.value)} placeholder="From" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact Person" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="text" value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} placeholder="Contact Details" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>

            {/* Minimize Button */}
            <div className="px-6 py-2 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button type="button" onClick={() => setHeaderExpanded(false)} data-copilot="mo-minimize-header" className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-white transition-colors">
                Minimize Header
              </button>
            </div>
          </div>
        ) : (
          <div
            className={
              rounded
                ? 'bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-3 flex items-center justify-between'
                : 'bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between'
            }
          >
            <div className="text-sm text-slate-600">
              <span className="font-medium">To:</span> {toSupplier || 'Not set'} · 
              <span className="font-medium ml-2">From:</span> {fromCompany || 'Not set'} · 
              <span className="font-medium ml-2">Ref:</span> {reference || 'Not set'}
            </div>
            <button type="button" onClick={() => setHeaderExpanded(true)} className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors">
              Edit Header
            </button>
          </div>
        )}
      </div>
    );
  }

  // LINE-BY-LINE LAYOUT (Phase 2 editor).
  // Uses the SAME header system as the components (single/double) editor, then
  // the OrderLineByLineEditor for the priced item list + footer + taxes.
  if (initialLayout === 'line_by_line') {
    return (
      <>
        <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
        <AlertModal
          open={alertState.open}
          title={alertState.title}
          description={alertState.description}
          variant={alertState.variant}
          onClose={closeAlert}
        />
        {/* Flex column inside the page's h-screen/overflow-hidden wrapper. The
            header stays put; the editor area owns its OWN vertical scroll so the
            footer + taxes at the bottom are always reachable on any screen
            ratio (previously the page wrapper clipped them). */}
        <div className="flex flex-col h-screen bg-slate-50">
          <div className="px-6 pt-4 flex-shrink-0">
            <BackButton />
          </div>
          {/* Shared order header (template selector + To/From form + minimize),
              rounded-card variant to match the rest of the app. */}
          {renderOrderHeader(true)}
          {/* Scrollable editor region. Full-width (px-6) so the body frame lines
              up edge-to-edge with the full-width header above it. */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Save action sits directly above the editor/preview so it's
                reachable at 100% zoom without scrolling to the page bottom. */}
            <div className="flex items-center justify-end gap-3">
              {existingOrder && (
                <button
                  type="button"
                  onClick={() => window.open(`../material-orders/${existingOrder.order.id}/preview`, '_blank')}
                  className="px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-full hover:bg-slate-50 transition"
                >
                  Preview
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-6 py-2 text-sm font-semibold bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {saving ? 'Saving…' : 'Save Order'}
              </button>
            </div>

            {/* Line editor */}
            <OrderLineByLineEditor
              initialLines={lineByLineLines}
              initialFooter={lineByLineFooter}
              initialTaxes={lineByLineTaxes}
              initialHideLinePrices={lineByLineHideLinePrices}
              initialHideTotals={lineByLineHideTotals}
              initialShowQuantityColumn={lineByLineShowQuantityColumn}
              currency={currency}
              workspaceSlug={workspaceSlug}
              collections={collections}
              componentLibrary={componentLibrary}
              catalogs={catalogs}
              companyTaxes={companyTaxes}
              onChange={setLineByLineLines}
              onFooterChange={setLineByLineFooter}
              onTaxesChange={setLineByLineTaxes}
              onHideLinePricesChange={setLineByLineHideLinePrices}
              onHideTotalsChange={setLineByLineHideTotals}
              onShowQuantityColumnChange={setLineByLineShowQuantityColumn}
            />
            <div className="pb-10" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Back Button */}
      <div className="px-6 pt-4">
        <BackButton />
      </div>
      
      {/* Header Section (shared with the line-by-line layout) */}
      {renderOrderHeader()}

      {/* Main Content Area - Sidebar + Order Form */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Order Components Control Panel (collapsible). Width
            animates to 0 on collapse; the flex-1 order-form pane auto-fills.
            Sidebar stays mounted (no state loss) - only its width/opacity
            transition. */}
        <div
          className={`bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
            componentsPanelCollapsed ? 'w-0 opacity-0 pointer-events-none border-r-0' : 'w-80 opacity-100'
          }`}
          data-copilot="mo-sidebar"
          aria-hidden={componentsPanelCollapsed}
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">Order Components</h3>
              <CollapseButton
                collapsed={componentsPanelCollapsed}
                onToggle={() => setComponentsPanelCollapsed(true)}
                label="Collapse panel"
              />
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Control what appears in the order form
            </p>
          </div>

          {/* Add Component Button - Top */}
          <div className="px-4 py-3 border-b border-slate-200">
            <button
              type="button"
              onClick={openAddItemModal}
              className="w-full px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors"
            >
              + Add Component
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {orderLines.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs mb-3">No components added</p>
                <button
                  type="button"
                  onClick={openAddItemModal}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Component
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orderLines.map((line, index) => (
                  <div key={line.id} onMouseEnter={() => setHoveredLineId(line.id)} onMouseLeave={() => setHoveredLineId(null)} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 cursor-pointer transition-all duration-150 hover:border-orange-300 hover:shadow-[0_0_8px_rgba(255,107,53,0.12)]">
                    {/* Component Header - click anywhere toggles expand/collapse */}
                    <div
                      className="px-3 py-2 bg-white border-b border-slate-200"
                      onClick={() => toggleCollapsed(line.id)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {/* Up/Down Arrows */}
                        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => moveLineUp(line.id)}
                            disabled={index === 0}
                            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLineDown(line.id)}
                            disabled={index === orderLines.length - 1}
                            className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <h4 className="flex-1 font-bold text-sm text-slate-900 leading-tight">{line.componentName}</h4>
                        {/* Collapse toggle */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleCollapsed(line.id); }}
                          className="p-0.5 rounded hover:bg-slate-100 text-slate-400 flex-shrink-0"
                          title={collapsedLines.has(line.id) ? 'Expand' : 'Collapse'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsedLines.has(line.id) ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                          </svg>
                        </button>
                      </div>
                      {!collapsedLines.has(line.id) && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditModal(line.id)}
                          className="flex-1 px-2 py-1 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="flex-1 px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                      )}
                    </div>

                    {/* Visibility Controls - hidden when collapsed */}
                    {!collapsedLines.has(line.id) && (
                    <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-white rounded px-2 py-1.5 transition-colors">
                        <input
                          type="checkbox"
                          checked={line.showComponentName}
                          onChange={() => toggleLineVisibility(line.id, 'showComponentName')}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span>Show Name</span>
                      </label>
                      
                      {/* Flashing Drawing Selector (searchable) */}
                      <div className="px-2 py-1.5">
                        {(() => {
                          const quoteComponentId = line.id.startsWith('quote-') ? line.id.replace('quote-', '') : null;
                          const quoteComponent = quoteComponentId ? quoteData?.components.find(c => c.id === quoteComponentId) : null;
                          const linkedFlashingIds = quoteComponent?.component_library?.flashing_ids || [];
                          return (
                            <SearchableFlashingSelect
                              flashings={flashings}
                              value={line.flashingId}
                              onChange={(newFlashingId) => {
                                const updatedFlashing = newFlashingId ? flashings.find(f => f.id === newFlashingId) : undefined;
                                setOrderLines(orderLines.map(l =>
                                  l.id === line.id
                                    ? {
                                        ...l,
                                        flashingId: newFlashingId,
                                        flashingImageUrl: updatedFlashing?.image_url,
                                        showFlashingImage: !!newFlashingId
                                      }
                                    : l
                                ));
                              }}
                              linkedFlashingIds={linkedFlashingIds.length > 0 ? linkedFlashingIds : undefined}
                              label="Flashing Drawing:"
                              size="sm"
                            />
                          );
                        })()}
                      </div>
                      
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-white rounded px-2 py-1.5 transition-colors">
                        <input
                          type="checkbox"
                          checked={line.showMeasurements}
                          onChange={() => toggleLineVisibility(line.id, 'showMeasurements')}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span>Show Measurements</span>
                      </label>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expand tab - only visible when the sidebar is collapsed. Lives
            between the sidebar and the form pane so it is never clipped.
            items-start keeps it pinned to the TOP of the column. */}
        <div className="flex items-start px-1 py-2">
          <ExpandTab
            collapsed={componentsPanelCollapsed}
            onToggle={() => setComponentsPanelCollapsed(false)}
            label="Components"
          />
        </div>

        {/* RIGHT - Order Form Display */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {/* Toolbar */}
          <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-semibold text-slate-900">Order Form</h3>
              <p className="text-xs text-slate-400 italic">
                Tip: to view the full preview with header, save, then view order.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600" data-copilot="mo-layout-toggle">
                <button
                  type="button"
                  onClick={() => setLayoutMode('single')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    layoutMode === 'single'
                      ? 'bg-[#FF6B35] text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Single Column
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('double')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    layoutMode === 'double'
                      ? 'bg-[#FF6B35] text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Double Column
                </button>
              </div>
            </div>
          </div>

          {/* Order Form Content - A4 Preview */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className="max-w-[210mm] mx-auto bg-white shadow-lg" style={{ minHeight: '297mm' }}>
              <div className="p-8">
                {/* Order Header */}
                <div className="mb-6 pb-6 border-b-2 border-slate-300">
                  {/* 3-Column Header Layout */}
                  <div className="grid grid-cols-3 gap-8">
                    {/* Column 1: TO section (left-aligned) */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">To:</p>
                      <p className="text-sm font-medium text-slate-900">{toSupplier || 'Not set'}</p>
                      {reference && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Ref:</span> {reference}
                        </p>
                      )}
                      {orderType && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Order Type:</span> {orderType}
                        </p>
                      )}
                      {colours && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Colours:</span> {colours}
                        </p>
                      )}
                      
                      {deliveryAddress && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Delivery Address:</p>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{deliveryAddress}</p>
                        </div>
                      )}
                      
                      {deliveryDate && (
                        <p className="text-xs text-slate-600 mt-2">
                          <span className="font-medium">Delivery Date:</span> {new Date(deliveryDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    {/* Column 2: Spacer (breathing room) */}
                    <div></div>
                    
                    {/* Column 3: Logo + FROM section (left-aligned) */}
                    <div className="space-y-3">
                      {/* Logo pinned to top, max height */}
                      {logoUrl && (
                        <div className="flex items-start">
                          <img src={logoUrl} alt="Logo" className="max-h-16 max-w-full object-contain" />
                        </div>
                      )}
                      
                      {/* FROM section - left-aligned */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase">From:</p>
                        <p className="text-sm font-medium text-slate-900">{fromCompany || 'Not set'}</p>
                        {contactPerson && (
                          <p className="text-xs text-slate-600">{contactPerson}</p>
                        )}
                        {contactDetails && (
                          <p className="text-xs text-slate-600">{contactDetails}</p>
                        )}
                        {orderDate && (
                          <p className="text-xs text-slate-600 mt-2">
                            <span className="font-medium">Order Date:</span> {new Date(orderDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {orderNotes && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes:</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{orderNotes}</p>
                    </div>
                  )}
                </div>

                {/* Components Section */}
            {orderLines.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm mb-4">No items added yet</p>
                <p className="text-xs text-slate-400 mb-4">
                  {quoteData 
                    ? 'Select items from the sidebar to add them here'
                    : 'Add custom items to get started'
                  }
                </p>
                <button
                  type="button"
                  onClick={openAddItemModal}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  Add Custom Item
                </button>
              </div>
            ) : (
              <div className={layoutMode === 'double' ? 'grid grid-cols-2 gap-6' : 'space-y-6'}>
                {orderLines.map(line => (
                  <div key={line.id} className={`bg-white border rounded-lg p-4 space-y-3 transition-all duration-150 ${hoveredLineId === line.id ? 'border-[#FF6B35] ring-2 ring-[#FF6B35] ring-inset bg-orange-50/20' : 'border-slate-200'}`}>
                    {/* Component Name */}
                    {line.showComponentName && (
                      <h4 className="font-semibold text-slate-900 text-base">{line.componentName}</h4>
                    )}

                    {/* Flashing Image */}
                    {line.showFlashingImage && line.flashingImageUrl && (
                      <div>
                        <img 
                          src={line.flashingImageUrl} 
                          alt="Flashing" 
                          className={`border border-slate-200 rounded ${layoutMode === 'double' ? 'w-full' : 'w-full max-w-md'}`}
                        />
                      </div>
                    )}

                    {/* Measurements */}
                    {line.showMeasurements && (
                      <div className="text-sm text-slate-700">
                        {line.entryMode === 'single' ? (
                          <p className="font-medium">
                            Quantity: <span className="text-black">{line.pricedQuantity ?? line.quantity}</span>
                            {line.measurementDisplay && (
                              <span className="text-slate-400 ml-1">({line.measurementDisplay})</span>
                            )}
                          </p>
                        ) : (
                          <div>
                            {line.pricedQuantity != null && (
                              <p className="font-medium">
                                Quantity: <span className="text-black">{line.pricedQuantity}</span>
                                {line.measurementDisplay && (
                                  <span className="text-slate-400 ml-1">({line.measurementDisplay})</span>
                                )}
                              </p>
                            )}
                            {line.pricedQuantity == null && (
                              <>
                                <p className="font-medium text-xs text-slate-500 uppercase mb-2">
                                  {line.entryMode === 'area' ? 'Areas' : line.entryMode === 'volume' ? 'Volumes' : 'Lengths'} ({line.lengthUnit}):
                                </p>
                                <div className="space-y-2">
                                  {line.lengths?.map((entry, idx) => (
                                    <div key={idx}>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{entry.length}{line.lengthUnit}</span>
                                        <span className="text-slate-400">×</span>
                                        <span className="text-slate-600">{entry.multiplier}</span>
                                      </div>
                                      {entry.variables && entry.variables.length > 0 && (
                                        <div className="text-xs text-slate-500 pl-4 mt-0.5">
                                          {entry.variables.map((v, vIdx) => (
                                            <span key={vIdx} className="mr-2">
                                              {v.name}={v.value}{v.unit}
                                              {vIdx < entry.variables!.length - 1 && ', '}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {line.notes && <p className="text-slate-600 mt-2 text-xs italic">{line.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push('../material-orders')}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {existingOrder && (
              <button
                type="button"
                onClick={() => window.open(`../material-orders/${existingOrder.order.id}/preview`, '_blank')}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium rounded-full bg-slate-900 text-white hover:shadow-[0_0_15px_rgba(255,107,53,0.5)] hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Preview
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              data-copilot="mo-save"
              className="px-6 py-2.5 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          flashings={flashings}
          components={components}
          collections={collections}
          workspaceSlug={workspaceSlug}
          measurementSystem={effectiveMeasurementSystem}
          existingLine={editingLineId ? orderLines.find(l => l.id === editingLineId) : undefined}
          onSave={saveLineItem}
          onCancel={() => {
            setShowAddItemModal(false);
            setEditingLineId(null);
          }}
          showAlert={showAlert}
        />
      )}

      {/* Remove line confirmation - replaces native confirm() with app-style modal. */}
      <ConfirmModal
        open={removeConfirmId !== null}
        title="Remove this item?"
        description="This removes the item from the order. This can't be undone."
        confirmLabel="Remove"
        onCancel={() => setRemoveConfirmId(null)}
        onConfirm={confirmRemoveLine}
      />

      {/* App-style alert replaces native alert() across the order create flow. */}
      <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />
    </div>
    </>
  );
}

// Add Item Modal Component
interface AddItemModalProps {
  flashings: FlashingLibraryRow[];
  /** Company component library for the "add from library" dropdown. */
  components?: ComponentOption[];
  /** Named component libraries for the add-component library selector. */
  collections?: ComponentCollection[];
  /** Workspace slug for the catalog search modal endpoint. */
  workspaceSlug?: string;
  /** Company/quote measurement system - drives metric vs imperial unit options. */
  measurementSystem?: string;
  existingLine?: OrderLineItem;
  onSave: (data: {
    componentName: string;
    flashingId?: string;
    entryMode: OrderEntryMode;
    quantity?: number;
    unit?: string;
    lengths?: LengthEntry[];
    lengthUnit?: string;
    notes?: string;
    pricedQuantity?: number;
    measurementDisplay?: string;
  }) => void;
  onCancel: () => void;
  /** Inherited from the parent so this modal can pop the same app-style alerts instead of native ones. */
  showAlert: (title: string, description?: string, variant?: 'info' | 'success' | 'error') => void;
}

function AddItemModal({ flashings, components = [], collections = [], workspaceSlug = '', measurementSystem = 'metric', existingLine, onSave, onCancel, showAlert }: AddItemModalProps) {
  const [showAngleCalc, setShowAngleCalc] = useState(false);
  const [angleCopied, setAngleCopied] = useState(false);

  function handleAngleApply(angle: number) {
    void navigator.clipboard.writeText(String(angle)).then(() => {
      setAngleCopied(true);
      setTimeout(() => setAngleCopied(false), 2500);
    });
  }

  // Metric vs imperial drives every unit option in this modal so the two
  // systems never mix. imperial_ft / imperial_rs / imperial all map to imperial.
  const isMetric = measurementSystem === 'metric';
  const isImperialRs = measurementSystem === 'imperial_rs' || measurementSystem === 'imperial';
  // Area unit depends on the full system: m² (metric), ft² (imperial_ft),
  // or RS Roofing Squares (imperial_rs / legacy imperial).
  const UNITS = isMetric
    ? { linear: 'm', area: 'm\u00b2', volume: 'm\u00b3' }
    : isImperialRs
      ? { linear: 'ft', area: 'RS', volume: 'ft\u00b3' }
      : { linear: 'ft', area: 'ft\u00b2', volume: 'ft\u00b3' };
  // Variable dimension units by system (Task 3): metric mm/M/°, imperial in/ft/°.
  const VAR_UNITS: { value: string; label: string }[] = isMetric
    ? [ { value: 'mm', label: 'mm' }, { value: 'm', label: 'M' }, { value: '\u00b0', label: '\u00b0' } ]
    : [ { value: 'in', label: 'in' }, { value: 'ft', label: 'ft' }, { value: '\u00b0', label: '\u00b0' } ];

  const [componentName, setComponentName] = useState(existingLine?.componentName || '');
  // Library filter for the "Add from component library" dropdown. "All" shows
  // every company component regardless of which named library it belongs to.
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(ALL_LIBRARIES);
  // Catalog search modal toggle (one of the three ways to fill the item name).
  const [showCatalogSearch, setShowCatalogSearch] = useState(false);
  const [flashingId, setFlashingId] = useState(existingLine?.flashingId || '');
  const [entryMode, setEntryMode] = useState<OrderEntryMode>(existingLine?.entryMode || 'single');
  
  // Single mode (unit dropdown removed - quantity + optional description only)
  const [quantity, setQuantity] = useState(existingLine?.quantity || 0);
  const [unit, setUnit] = useState(existingLine?.unit || 'pcs');
  
  // Linear / area / volume entries (all stored in `lengths`).
  // lengthUnit is derived from the measurement system, not user-chosen.
  const [lengths, setLengths] = useState<LengthEntry[]>(existingLine?.lengths || []);
  const entryUnit = entryMode === 'area' ? UNITS.area : entryMode === 'volume' ? UNITS.volume : UNITS.linear;
  const [newLength, setNewLength] = useState(0);
  const [newMultiplier, setNewMultiplier] = useState(1);
  // Area/volume calculator inputs (optional - user can type the total directly).
  const [calcL, setCalcL] = useState(0);
  const [calcW, setCalcW] = useState(0);
  const [calcD, setCalcD] = useState(0);
  
  // Variables for current length entry
  const [showVariables, setShowVariables] = useState(false);
  const [currentVariables, setCurrentVariables] = useState<Variable[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState(0);
  const [newVarUnit, setNewVarUnit] = useState(VAR_UNITS[0].value);
  
  const [notes, setNotes] = useState(existingLine?.notes || '');
  
  // Fixed Quantity display overrides: editable text values that show in the
  // order preview (e.g. "5" and "231.71m²"). Pre-fill from existingLine when
  // editing; empty for new items. These are order-line-only — they never
  // write back to the quote or component library.
  const [pricedQuantity, setPricedQuantity] = useState(
    existingLine?.pricedQuantity != null ? String(existingLine.pricedQuantity) : ''
  );
  // Split measurementDisplay into numeric value + unit selector so the user
  // doesn't have to type the unit manually. Parse from existingLine if present.
  // All common units available in the dropdown so the user can pick
  // whatever fits — includes RS (Roofing Squares) for imperial_rs users.
  const FIXED_QTY_UNITS = isMetric
    ? [UNITS.area, UNITS.linear, UNITS.volume]
    : isImperialRs
      ? ['RS', 'ft\u00b2', 'ft', 'ft\u00b3', 'm\u00b2', 'm']
      : ['ft\u00b2', 'ft', 'ft\u00b3', 'm\u00b2', 'm'];
  function parseMeasurementDisplay(raw: string): { value: string; unit: string } {
    if (!raw) return { value: '', unit: FIXED_QTY_UNITS[0] };
    // Try to split numeric prefix from unit suffix (e.g. "38.56m²" → "38.56" + "m²").
    const match = raw.match(/^([\d.\s]+)\s*(.*)$/);
    if (match) {
      const val = match[1].trim();
      const unit = match[2].trim();
      return { value: val, unit: unit || FIXED_QTY_UNITS[0] };
    }
    return { value: raw, unit: FIXED_QTY_UNITS[0] };
  }
  const parsedInitial = parseMeasurementDisplay(existingLine?.measurementDisplay || '');
  const [measurementValue, setMeasurementValue] = useState(parsedInitial.value);
  const [measurementUnit, setMeasurementUnit] = useState(parsedInitial.unit);
  // Toggle for showing the Fixed Quantity Display section on new items.
  // Auto-shows when editing a line that already has pricedQuantity.
  const [showFixedQty, setShowFixedQty] = useState(existingLine?.pricedQuantity != null);
  
  function addVariable() {
    if (!newVarName.trim()) {
      showAlert('Variable name required', 'Please enter a name for the variable.', 'info');
      return;
    }
    if (newVarValue <= 0) {
      showAlert('Invalid variable value', 'The variable value must be greater than 0.', 'info');
      return;
    }
    
    setCurrentVariables([...currentVariables, { 
      name: newVarName.trim(), 
      value: newVarValue, 
      unit: newVarUnit 
    }]);
    setNewVarName('');
    setNewVarValue(0);
    setNewVarUnit(VAR_UNITS[0].value);
  }
  
  function removeVariable(index: number) {
    setCurrentVariables(currentVariables.filter((_, i) => i !== index));
  }

  // Area/volume calculator: total = L x W (area) or L x W x D (volume).
  // Returns null when the relevant calc inputs aren't all filled.
  function calcTotal(): number | null {
    if (entryMode === 'area') {
      if (calcL > 0 && calcW > 0) return calcL * calcW;
      return null;
    }
    if (entryMode === 'volume') {
      if (calcL > 0 && calcW > 0 && calcD > 0) return calcL * calcW * calcD;
      return null;
    }
    return null;
  }
  
  function addLength() {
    // For area/volume the value can come from the calculator OR a typed total.
    const calc = calcTotal();
    const value = calc != null ? calc : newLength;
    if (value <= 0) {
      const label = entryMode === 'area' ? 'area' : entryMode === 'volume' ? 'volume' : 'length';
      showAlert(`Invalid ${label}`, `The ${label} must be greater than 0. Enter it directly or use the calculator.`, 'info');
      return;
    }
    if (newMultiplier <= 0) {
      showAlert('Invalid multiplier', 'The multiplier must be greater than 0.', 'info');
      return;
    }
    
    setLengths([...lengths, { 
      length: Number(value.toFixed(4)), 
      multiplier: newMultiplier,
      variables: currentVariables.length > 0 ? currentVariables : undefined,
      ...(calc != null ? { calcLength: calcL, calcWidth: calcW, ...(entryMode === 'volume' ? { calcDepth: calcD } : {}) } : {}),
    }]);
    setNewLength(0);
    setNewMultiplier(1);
    setCalcL(0);
    setCalcW(0);
    setCalcD(0);
    setCurrentVariables([]);
    setShowVariables(false);
  }
  
  function removeLength(index: number) {
    setLengths(lengths.filter((_, i) => i !== index));
  }
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!componentName.trim()) {
      showAlert('Component name required', 'Please enter a name for this component.', 'info');
      return;
    }

    // Parse fixed-quantity display overrides. Empty = not set (falls back to
    // normal display). pricedQuantity is parsed as a number; measurementDisplay
    // is free-text so the user can type "240m²" or anything else.
    const parsedPricedQty = pricedQuantity.trim() === '' ? undefined : parseFloat(pricedQuantity);
    // Combine numeric value + unit selector into the display string.
    const trimmedMeasurement = measurementValue.trim() === ''
      ? undefined
      : `${measurementValue.trim()}${measurementUnit}`;

    if (entryMode === 'single') {
      if (quantity <= 0) {
        showAlert('Invalid quantity', 'The quantity must be greater than 0.', 'info');
        return;
      }
      
      onSave({
        componentName: componentName.trim(),
        flashingId: flashingId || undefined,
        entryMode: 'single',
        quantity,
        // Single items no longer carry a unit dropdown; keep a neutral default
        // so existing render/save paths that read `unit` stay happy.
        unit: unit || 'pcs',
        notes: notes.trim() || undefined,
        pricedQuantity: parsedPricedQty,
        measurementDisplay: trimmedMeasurement,
      });
    } else {
      // linear / area / volume all accumulate into `lengths`.
      const label = entryMode === 'area' ? 'area' : entryMode === 'volume' ? 'volume' : 'length';
      if (lengths.length === 0) {
        showAlert(`No ${label} entries`, `Add at least one ${label} entry before saving.`, 'info');
        return;
      }
      
      onSave({
        componentName: componentName.trim(),
        flashingId: flashingId || undefined,
        entryMode,
        lengths,
        lengthUnit: entryUnit,
        notes: notes.trim() || undefined,
        pricedQuantity: parsedPricedQty,
        measurementDisplay: trimmedMeasurement,
      });
    }
  }
  
  const selectedFlashing = flashingId ? flashings.find(f => f.id === flashingId) : undefined;
  
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {existingLine ? 'Edit Order Item' : 'Add Order Item'}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">Enter component details and measurements</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Three ways to fill the item name: (1) pick from the component
              library, (2) search a catalog, (3) just type it. All three feed
              the same Component Name field below. Editing an existing item only
              needs name/image/measurements, so these pickers are add-only. */}
          {!existingLine && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Add from component library <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              {/* Library selector: pick a named library or "All components".
                  Only shown when the company has named libraries. */}
              {collections.length > 0 && (
                <select
                  value={selectedLibraryId}
                  onChange={(e) => setSelectedLibraryId(e.target.value)}
                  className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  aria-label="Filter components by library"
                >
                  <option value={ALL_LIBRARIES}>All components</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              )}
              {(() => {
                const filtered = components.filter((c) =>
                  selectedLibraryId === ALL_LIBRARIES
                    ? true
                    : (c.collection_id ?? null) === selectedLibraryId,
                );
                const showLib = selectedLibraryId === ALL_LIBRARIES && collections.length > 0;
                return (
                  <select
                    value=""
                    onChange={(e) => {
                      const picked = components.find((c) => c.id === e.target.value);
                      if (picked) setComponentName(picked.name);
                    }}
                    disabled={filtered.length === 0}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {components.length === 0
                        ? 'No saved components'
                        : filtered.length === 0
                          ? 'No components in this library'
                          : 'Choose a component…'}
                    </option>
                    {filtered.map((c) => {
                      const libName = showLib && c.collection_id
                        ? collections.find((col) => col.id === c.collection_id)?.name
                        : null;
                      return (
                        <option key={c.id} value={c.id}>
                          {libName ? `${c.name} · ${libName}` : c.name}
                        </option>
                      );
                    })}
                  </select>
                );
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Or search a catalog <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCatalogSearch(true)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-left text-slate-600 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
                Search catalog items…
              </button>
            </div>
          </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Component Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              required
              placeholder="e.g., Ridge Flashing, Valley Gutter - or pick/search above"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="mt-1 text-xs text-slate-400">Pick from your library or search a catalog above, or type a custom item here.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Flashing Drawing <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <SearchableFlashingSelect
              flashings={flashings}
              value={flashingId || undefined}
              onChange={(id) => setFlashingId(id || '')}
              size="md"
              placeholder="Search drawings & images..."
            />
            {selectedFlashing && (
              <div className="mt-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
                <img 
                  src={selectedFlashing.image_url} 
                  alt={selectedFlashing.name}
                  className="w-full max-w-sm mx-auto"
                />
              </div>
            )}
          </div>

          {/* Fixed Quantity Display: editable text overrides that show in the
              order preview as "Quantity: N (measurement)". Pre-fills from the
              existing line when editing. For new items, a toggle reveals the
              fields. These are order-line-only display values — they never
              write back to the quote or component library. */}
          {(existingLine?.pricedQuantity != null || showFixedQty) && (
            <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Fixed Quantity Display
                </label>
                {!existingLine?.pricedQuantity && (
                  <button
                    type="button"
                    onClick={() => setShowFixedQty(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                These values appear in the order as "Quantity: N (measurement)". Edit them to adjust what shows on this order — the quote stays unchanged.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                  <input
                    type="text"
                    value={pricedQuantity}
                    onChange={(e) => setPricedQuantity(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Measurement</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={measurementValue}
                      onChange={(e) => setMeasurementValue(e.target.value)}
                      placeholder="e.g. 231.71"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <select
                      value={measurementUnit}
                      onChange={(e) => setMeasurementUnit(e.target.value)}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {FIXED_QTY_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Show toggle to add Fixed Quantity Display for new items or items
              that don't already have it. */}
          {existingLine?.pricedQuantity == null && !showFixedQty && (
            <button
              type="button"
              onClick={() => setShowFixedQty(true)}
              className="text-sm text-[#FF6B35] hover:text-orange-700 font-medium"
            >
              + Add Fixed Quantity Display
            </button>
          )}

          {/* Item Type: defines what the measurement section below looks like.
              Linear / Area / Volume accumulate entries; Single is qty-only. */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Item Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { mode: 'area' as const, label: 'Area' },
                { mode: 'volume' as const, label: 'Volume' },
                { mode: 'linear' as const, label: 'Linear' },
                { mode: 'single' as const, label: 'Single Item' },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEntryMode(mode)}
                  className={`px-3 py-2 text-sm font-medium rounded-full border transition-colors ${
                    entryMode === mode
                      ? 'bg-[#FF6B35] text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {entryMode === 'single'
                ? 'For bulk items (rolls, sheets, pieces) - quantity only'
                : entryMode === 'area'
                  ? `Area-based items, measured in ${UNITS.area}`
                  : entryMode === 'volume'
                    ? `Volume-based items, measured in ${UNITS.volume}`
                    : `Length-based items, measured in ${UNITS.linear}`}
            </p>
          </div>

          {/* Single Mode Inputs: quantity + optional description (no unit dropdown) */}
          {entryMode === 'single' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  required
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 25kg bags, 3m lengths, box of 100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* Linear / Area / Volume entries (all accumulate into `lengths`). */}
          {entryMode !== 'single' && (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {entryMode === 'area' ? 'Add Area Entry' : entryMode === 'volume' ? 'Add Volume Entry' : 'Add Length Entry'}
                </label>

                {/* Calculator for area / volume: L x W (x D). Optional - the
                    user can also type the total directly in the field below. */}
                {(entryMode === 'area' || entryMode === 'volume') && (
                  <div className="mb-3 p-2 rounded-lg border border-slate-200 bg-white">
                    <p className="text-xs text-slate-500 mb-2">Calculator (optional) - or type the total directly below</p>
                    <div className="flex items-center gap-2">
                      <input type="number" value={calcL || ''} onChange={(e) => setCalcL(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder={`L (${UNITS.linear})`} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      <span className="text-slate-400">×</span>
                      <input type="number" value={calcW || ''} onChange={(e) => setCalcW(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder={`W (${UNITS.linear})`} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      {entryMode === 'volume' && (<>
                        <span className="text-slate-400">×</span>
                        <input type="number" value={calcD || ''} onChange={(e) => setCalcD(parseFloat(e.target.value) || 0)} step="0.01" min="0" placeholder={`D (${UNITS.linear})`} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                      </>)}
                    </div>
                    {calcTotal() != null && (
                      <p className="text-xs text-slate-600 mt-2">= <span className="font-medium">{calcTotal()!.toFixed(2)} {entryUnit}</span></p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={newLength || ''}
                      onChange={(e) => setNewLength(parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      placeholder={entryMode === 'area' ? `Area total (${UNITS.area})` : entryMode === 'volume' ? `Volume total (${UNITS.volume})` : 'Length (e.g., 5.55)'}
                      disabled={(entryMode === 'area' || entryMode === 'volume') && calcTotal() != null}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  <span className="flex items-center text-slate-400 font-medium">×</span>
                  <div className="w-20">
                    <input
                      type="number"
                      value={newMultiplier || ''}
                      onChange={(e) => setNewMultiplier(parseInt(e.target.value) || 1)}
                      min="1"
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Variables Section (Optional) */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowVariables(!showVariables)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors flex items-center justify-between"
                  >
                    <span>{showVariables ? '▼' : '▶'} Advanced</span>
                    {currentVariables.length > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                        {currentVariables.length}
                      </span>
                    )}
                  </button>
                  
                  {showVariables && (
                    <div className="mt-2 p-3 border border-slate-200 rounded-lg bg-white space-y-2">
                      <p className="text-xs text-slate-600">Add dimension variables (e.g., x, y, z) for custom measurements</p>
                      
                      {/* Add Variable Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          placeholder="Name (x, y, z)"
                          maxLength={3}
                          className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        />
                        <span className="flex items-center text-slate-400">=</span>
                        <input
                          type="number"
                          value={newVarValue || ''}
                          onChange={(e) => setNewVarValue(parseFloat(e.target.value) || 0)}
                          step="0.1"
                          min="0"
                          placeholder="Value"
                          className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        />
                        <select
                          value={newVarUnit}
                          onChange={(e) => setNewVarUnit(e.target.value)}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded text-sm"
                        >
                          {VAR_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={addVariable}
                          className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-700 text-white hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </div>

                      {/* Variable List */}
                      {currentVariables.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-slate-200">
                          {currentVariables.map((variable, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1.5 text-sm">
                              <span>
                                <span className="font-medium">{variable.name}</span>
                                <span className="text-slate-400 mx-1">=</span>
                                <span>{variable.value}{variable.unit}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeVariable(idx)}
                                className="text-red-600 hover:text-red-700 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addLength}
                  className="w-full px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600"
                >
                  {entryMode === 'area' ? 'Add Area Entry' : entryMode === 'volume' ? 'Add Volume Entry' : 'Add Length Entry'}
                </button>

                {/* Entry List */}
                {lengths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 uppercase">
                      {entryMode === 'area' ? 'Added Areas:' : entryMode === 'volume' ? 'Added Volumes:' : 'Added Lengths:'}
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {lengths.map((entry, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">
                              <span className="font-medium">{entry.length}{entryUnit}</span>
                              <span className="text-slate-400 mx-2">×</span>
                              <span className="text-slate-600">{entry.multiplier}</span>
                              {entry.calcLength != null && entry.calcWidth != null && (
                                <span className="text-xs text-slate-400 italic ml-2">
                                  ({entry.calcLength}×{entry.calcWidth}{entry.calcDepth != null ? `×${entry.calcDepth}` : ''})
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLength(idx)}
                              className="text-red-600 hover:text-red-700 text-xs font-medium"
                            >
                              Remove
                            </button>
                          </div>
                          {entry.variables && entry.variables.length > 0 && (
                            <div className="text-xs text-slate-600 pl-2 border-l-2 border-slate-200">
                              {entry.variables.map((v, vIdx) => (
                                <span key={vIdx} className="mr-2">
                                  <span className="font-medium">{v.name}</span>=<span>{v.value}{v.unit}</span>
                                  {vIdx < entry.variables!.length - 1 && <span className="text-slate-400">, </span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Single-item mode already exposes `notes` as its Description field
              above, so the general Notes textarea is hidden there to avoid two
              inputs bound to the same state. */}
          {entryMode !== 'single' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or specifications..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setShowAngleCalc(true)}
            className="px-6 py-2.5 text-sm font-medium rounded-full border-2 border-[#FF6B35] text-[#FF6B35] hover:bg-orange-50 transition-colors"
          >
            Angle Calc
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            {existingLine ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* Catalog search - reuses the same modal as the blank-quote builder.
          On pick it fills the Component Name (and appends the quantity text if
          the catalog has one). It does not touch price; order lines price
          separately. */}
      {showCatalogSearch && (
        <CatalogSearchModal
          workspaceSlug={workspaceSlug}
          onAdd={(text, _amount, _showPrice, quantity) => {
            const composed = quantity ? `${text} - ${quantity}` : text;
            setComponentName(composed);
            setShowCatalogSearch(false);
          }}
          onClose={() => setShowCatalogSearch(false)}
        />
      )}

      {/* Angle Calculator — floating draggable widget so the user can
          calculate an angle, copy it, and paste into any input without
          closing the calculator. */}
      <AngleCalculatorWidget
        isOpen={showAngleCalc}
        onClose={() => setShowAngleCalc(false)}
        onApply={handleAngleApply}
        currentAngle={0}
      />

      {/* Clipboard confirmation toast */}
      {angleCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full shadow-lg pointer-events-none">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Angle copied to clipboard!
        </div>
      )}
    </div>
  );
}
