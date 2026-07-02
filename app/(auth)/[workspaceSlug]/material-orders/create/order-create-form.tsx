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
import { AngleCalculatorWidget } from '../../drawings/draw/AngleCalculatorWidget';
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
// F-15: Extracted sub-component + shared types
import { AddItemModal } from './parts/AddItemModal';
import type { ComponentOption, ComponentCollection, OrderLineItem, OrderEntryMode, LengthEntry, Variable } from './parts/types';
import { ALL_LIBRARIES } from './parts/types';

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



/**
 * entryMode: 'single' (qty + optional description), 'linear' (length x qty
 * entries, formerly 'multiple'), 'area' (m2/ft2 entries), 'volume' (m3/ft3).
 * Legacy rows stored 'multiple' - normalised to 'linear' on load.
 */

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
