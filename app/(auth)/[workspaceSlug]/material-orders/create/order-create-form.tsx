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
import { QcStudioToolbar, QcStudioInspectorHeading, QcStudioSection, QcStudioOverview, type QcStudioOption } from '@/app/components/ui/v2/QcDocumentStudio';
import { OrderBody, type OrderDocumentData, type OrderDocumentLine } from '@/app/orders/[token]/OrderBody';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDocumentWorkspace, QcDocumentHeader, QcDocumentSaveState, QcDocumentBody, QcDocumentPanel, QcDocumentPanelHeader, QcDocumentSection, QcDocumentPreview, QcDocumentDialogScope } from '@/app/components/ui/v2/QcDocumentWorkspace';

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
  // Phase 5: start expanded at every width; the preview bar always restores it.
  const [componentsPanelCollapsed, setComponentsPanelCollapsed] = useState(false);
  // Hover-to-highlight: when the user hovers a component in the left sidebar,
  // the matching card in the order review gets an orange border so they can
  // quickly see which component they need to edit.
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [studioSection, setStudioSection] = useState('document');
  const [studioPreview, setStudioPreview] = useState(false);
  const [visualDraftDirty, setVisualDraftDirty] = useState(false);
  const [lineDraftPending, setLineDraftPending] = useState(false);
  const [pendingStudioTarget, setPendingStudioTarget] = useState<string | null>(null);
  
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
  function renderOrderHeader(_rounded = false) {
    return (
      <div className="qc-document-order-details">
        {headerExpanded ? (
          <div
            className="qc-document-order-details-card"
          >
            {/* Template Selector */}
            <div className="qc-document-order-template" data-copilot="mo-template">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Header template (optional)
                </label>
                <QcButton variant="ghost" size="sm" type="button" onClick={() => setHeaderExpanded(false)} data-copilot="mo-minimize-header" >
                  Minimize Header
                </QcButton>
              </div>
              <select aria-label="Order header template"
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
            <div className="qc-document-order-details-grid" data-copilot="mo-header-form">
              {/* LEFT COLUMN */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To (Supplier)</h3>
                <label className="qc-document-order-label">Supplier<input type="text" value={toSupplier} onChange={(e) => setToSupplier(e.target.value)} placeholder="To" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Reference / job name *<input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Order type<input type="text" value={orderType} onChange={(e) => setOrderType(e.target.value)} placeholder="Order Type (optional)" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Colours<input type="text" value={colours} onChange={(e) => setColours(e.target.value)} placeholder="Colours" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Delivery date<input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} placeholder="Delivery Date" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Delivery address<textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Delivery Address" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Order notes<textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Order Notes" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From (Your Company)</h3>
                <div className="flex items-start gap-3">
                  {logoUrl ? (
                    <div className="relative w-20 h-20 border border-slate-200 rounded bg-white">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      <QcButton variant="ghost" size="sm" type="button" aria-label="Remove company logo" onClick={() => setLogoUrl('')} className="absolute -top-1 -right-1 qc-document-icon qc-document-danger-control">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </QcButton>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
                      <span className="text-xs text-slate-400">Logo</span>
                    </div>
                  )}
                  <label className="qc-document-upload">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} aria-label="Upload company logo" />
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 hover:bg-slate-50">
                      {uploadingLogo ? 'Uploading...' : 'Upload'}
                    </span>
                  </label>
                </div>
                <label className="qc-document-order-label">Company<input type="text" value={fromCompany} onChange={(e) => setFromCompany(e.target.value)} placeholder="From" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Contact person<input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact Person" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base md:text-sm" /></label>
                <label className="qc-document-order-label">Contact details<input type="text" value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} placeholder="Contact Details" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></label>
                <label className="qc-document-order-label">Order date<input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></label>
              </div>
            </div>

            {/* Minimize button removed from bottom - now at top next to template selector */}
          </div>
        ) : (
          <div
            className="qc-document-order-summary"
          >
            <div className="text-sm text-slate-600">
              <span className="font-medium">To:</span> {toSupplier || 'Not set'} · 
              <span className="font-medium ml-2">From:</span> {fromCompany || 'Not set'} · 
              <span className="font-medium ml-2">Ref:</span> {reference || 'Not set'}
            </div>
            <QcButton variant="ghost" size="sm" type="button" onClick={() => setHeaderExpanded(true)} >
              Edit Header
            </QcButton>
          </div>
        )}
      </div>
    );
  }

  // Render-only projection: the save payload and measurement owners above stay intact.
  const orderPresentation: OrderDocumentData = {
    order_number: existingOrder?.order.order_number ?? '', to_supplier: toSupplier,
    from_company: fromCompany, contact_person: contactPerson, contact_details: contactDetails,
    reference, order_type: orderType, colours, delivery_date: deliveryDate,
    delivery_address: deliveryAddress, header_notes: orderNotes, logo_url: logoUrl,
    order_date: orderDate, layout_mode: isLineByLine ? 'line_by_line' : layoutMode,
  };
  const previewLines: OrderDocumentLine[] = orderLines.map(line => ({
    id: line.id, item_name: line.componentName, flashing_id: line.flashingId ?? null,
    flashing_image_url: line.flashingImageUrl ?? null, entry_mode: line.entryMode,
    quantity: line.quantity, lengths: line.lengths, length_unit: line.lengthUnit ?? null,
    item_notes: line.notes ?? null, show_component_name: line.showComponentName,
    show_flashing_image: line.showFlashingImage, show_measurements: line.showMeasurements,
    priced_quantity: line.pricedQuantity ?? null, measurement_display: line.measurementDisplay ?? null,
  }));
  const studioOptions: QcStudioOption[] = [
    { id: 'details', label: 'Order details', description: 'Supplier, delivery, your business and templates' },
  ];
  const studioLine = orderLines.find(line => line.id === editingLineId);
  function goToStudioSection(target: string) {
    setVisualDraftDirty(false); setStudioPreview(false); setComponentsPanelCollapsed(false);
    if (target === 'add') { setStudioSection('items'); openAddItemModal(); return; }
    setStudioSection(target);
    if (target.startsWith('line:')) { openEditModal(target.slice(5)); }
    else { setEditingLineId(null); setShowAddItemModal(false); }
    if (target === 'details') setHeaderExpanded(true);
  }
  function selectStudioSection(target: string) {
    if (target === studioSection) { setComponentsPanelCollapsed(false); setStudioPreview(false); return; }
    if (visualDraftDirty) { setPendingStudioTarget(target); return; }
    goToStudioSection(target);
  }

  if (initialLayout === 'line_by_line') {
    return (
      <QcDocumentWorkspace className="qc-document-studio">
        <QcDocumentHeader title="Line-by-line order" subtitle={reference || 'Add a reference in Order details before saving'}
          back={<BackButton />}
          status={<QcDocumentSaveState saving={saving} idle="Save to keep your changes" />}
          actions={<>
              {existingOrder && (
                <QcButton variant="ghost" size="sm"
                  type="button"
                  onClick={() => window.open(`../material-orders/${existingOrder.order.id}/preview`, '_blank')}
                  
                >
                  Preview
                </QcButton>
              )}
              <QcButton variant="primary" size="md"
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || lineDraftPending}
                title={lineDraftPending ? "Apply item changes before saving the order" : undefined}
                
              >
                {saving ? 'Saving…' : 'Save Order'}
              </QcButton>
            </>} />
        <OrderLineByLineEditor details={renderOrderHeader(true)} document={orderPresentation} onDraftChange={setLineDraftPending}
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
        <QcDocumentDialogScope><StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} /><AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      /></QcDocumentDialogScope>
      </QcDocumentWorkspace>
    );
  }

  return (
    <QcDocumentWorkspace className="qc-document-studio">
      <QcDocumentHeader title="Visual order" subtitle={reference || 'Add a reference in Order details before saving'}
        back={<BackButton />}
        status={<QcDocumentSaveState saving={saving} idle="Save to keep your changes" />}
        actions={<>
            <QcButton variant="ghost" size="sm"
              type="button"
              onClick={() => router.push('../material-orders')}
              disabled={saving}
              
            >
              Cancel
            </QcButton>
            {existingOrder && (
              <QcButton variant="ghost" size="sm"
                type="button"
                onClick={() => window.open(`../material-orders/${existingOrder.order.id}/preview`, '_blank')}
                disabled={saving}
                
              >
                Preview
              </QcButton>
            )}
            <QcButton variant="primary" size="md"
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || visualDraftDirty}
              title={visualDraftDirty ? "Apply component changes before saving the order" : undefined}
              data-copilot="mo-save"
              
            >
              {saving ? 'Saving...' : 'Save Order'}
            </QcButton>
          </>} />
      <QcStudioToolbar section={studioSection} onSelect={selectStudioSection} options={studioOptions}
        preview={studioPreview} onPreview={() => setStudioPreview(!studioPreview)}
        primary={<QcButton variant="secondary" size="sm" onClick={() => selectStudioSection('add')}>+ Add component</QcButton>}>
        <div className="qc-document-layout" role="group" aria-label="Visual order columns" data-copilot="mo-layout-toggle">
                <QcButton variant="ghost" size="sm"
                  type="button"
                  onClick={() => setLayoutMode('single')}
                  aria-pressed={layoutMode === 'single'}
                  
                >
                  1 column
                </QcButton>
                <QcButton variant="ghost" size="sm"
                  type="button"
                  onClick={() => setLayoutMode('double')}
                  aria-pressed={layoutMode === 'double'}
                  
                >
                  2 columns
                </QcButton>
              </div>
      </QcStudioToolbar>
      {visualDraftDirty && <p className="qc-document-note" role="status">Component changes are not applied yet. Choose Apply changes in the editing panel before saving.</p>}
      <QcDocumentBody collapsed={componentsPanelCollapsed || studioPreview}>
        <QcDocumentPanel collapsed={componentsPanelCollapsed || studioPreview} data-copilot="mo-sidebar">
          <QcStudioInspectorHeading section={studioSection}
            title={studioSection.startsWith('line:') ? 'Component' : studioSection === 'items' ? 'All components' : studioSection === 'details' ? 'Order details' : 'Your visual order'}
            onBack={() => selectStudioSection('document')} onCollapse={() => setComponentsPanelCollapsed(true)} />
          <QcStudioSection active={studioSection === 'document'}>
            <QcStudioOverview options={[...studioOptions, { id: 'items', label: 'Components & images', description: 'Choose a component to edit its name, drawing or measurements' }]} onSelect={selectStudioSection} />
            <p className="qc-studio-selection-note">Use 1 column or 2 columns above to change the layout. Your components and measurements stay the same.</p>
          </QcStudioSection>
          <QcStudioSection active={studioSection.startsWith('line:')}>
            {studioLine && <>
              <div className="qc-studio-line-controls">
                <div className="qc-document-line-toggles">
                  <label><input type="checkbox" checked={studioLine.showComponentName} onChange={() => toggleLineVisibility(studioLine.id, 'showComponentName')} /> Show name</label>
                  <label><input type="checkbox" checked={studioLine.showFlashingImage} onChange={() => toggleLineVisibility(studioLine.id, 'showFlashingImage')} /> Show image</label>
                  <label><input type="checkbox" checked={studioLine.showMeasurements} onChange={() => toggleLineVisibility(studioLine.id, 'showMeasurements')} /> Show measurements</label>
                </div>
                <div className="qc-document-row-actions">
                  <QcButton size="sm" onClick={() => moveLineUp(studioLine.id)} disabled={orderLines.indexOf(studioLine) === 0}>↑ Move up</QcButton>
                  <QcButton size="sm" onClick={() => moveLineDown(studioLine.id)} disabled={orderLines.indexOf(studioLine) === orderLines.length - 1}>↓ Move down</QcButton>
                  <QcButton size="sm" variant="ghost" className="qc-document-danger-control" onClick={() => removeLine(studioLine.id)}>Remove</QcButton>
                </div>
              </div>
              <p className="qc-studio-selection-note">Display switches update immediately. Apply detailed component changes when you are ready.</p>
              {showAddItemModal && <QcDocumentDialogScope><AddItemModal key={studioLine.id} embedded
                flashings={flashings} components={components} collections={collections} workspaceSlug={workspaceSlug}
                measurementSystem={effectiveMeasurementSystem} existingLine={studioLine} onDraftChange={setVisualDraftDirty}
                onSave={data => { saveLineItem(data); setVisualDraftDirty(false); setStudioSection('items'); }}
                onCancel={() => goToStudioSection('items')} showAlert={showAlert} /></QcDocumentDialogScope>}
            </>}
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'items'}>
          <div className="qc-document-panel-content">
            {orderLines.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs mb-3">No components added</p>
                <QcButton variant="secondary" size="sm"
                  type="button"
                  onClick={openAddItemModal}
                  
                >
                  Add Component
                </QcButton>
              </div>
            ) : (
              <div className="space-y-3">
                {orderLines.map((line, index) => (
                  <div key={line.id} onMouseEnter={() => setHoveredLineId(line.id)} onMouseLeave={() => setHoveredLineId(null)} className="qc-document-line">
                    {/* Component Header - click anywhere toggles expand/collapse */}
                    <div
                      className="px-3 py-2 bg-white border-b border-slate-200"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {/* Up/Down Arrows */}
                        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <QcButton variant="ghost" size="sm" aria-label="Move up"
                            type="button"
                            onClick={() => moveLineUp(line.id)}
                            disabled={index === 0}
                            className="qc-document-icon"
                            title="Move up"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </QcButton>
                          <QcButton variant="ghost" size="sm" aria-label="Move down"
                            type="button"
                            onClick={() => moveLineDown(line.id)}
                            disabled={index === orderLines.length - 1}
                            className="qc-document-icon"
                            title="Move down"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </QcButton>
                        </div>
                        <button type="button" className="qc-studio-item-link flex-1" onClick={() => selectStudioSection(`line:${line.id}`)}>{line.componentName}</button>
                        {/* Collapse toggle */}
                        <QcButton variant="ghost" size="sm"
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleCollapsed(line.id); }}
                          className="qc-document-icon"
                          title={collapsedLines.has(line.id) ? 'Expand' : 'Collapse'}
                          aria-expanded={!collapsedLines.has(line.id)}
                          aria-label={`${collapsedLines.has(line.id) ? 'Expand' : 'Collapse'} ${line.componentName}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsedLines.has(line.id) ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                          </svg>
                        </QcButton>
                      </div>
                      {!collapsedLines.has(line.id) && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <QcButton variant="ghost" size="sm"
                          type="button"
                          onClick={() => selectStudioSection(`line:${line.id}`)}
                          className="flex-1"
                        >
                          Edit
                        </QcButton>
                        <QcButton variant="ghost" size="sm"
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="flex-1 qc-document-icon qc-document-danger-control"
                        >
                          Remove
                        </QcButton>
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
                            <SearchableFlashingSelect appearance="v2"
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
          </QcStudioSection>
          <QcDocumentSection hidden={studioSection !== 'details'} title="Order details" className="qc-document-order-details-section">{renderOrderHeader()}</QcDocumentSection>
        </QcDocumentPanel>
        <QcDocumentPreview title={studioPreview ? 'Recipient preview' : 'Your visual order'}
          description={studioPreview ? 'The same document renderer is used for the saved order, supplier page and PDF.' : 'Click a component, image or header to edit it.'}
          collapsed={componentsPanelCollapsed || studioPreview} onExpand={() => { setComponentsPanelCollapsed(false); setStudioPreview(false); }}>
          <div className="qc-document-paper"><OrderBody order={orderPresentation} lines={previewLines} flashings={flashings} currency={currency}
            selection={studioPreview ? undefined : { active: studioSection, hovered: hoveredLineId ? `line:${hoveredLineId}` : undefined, onSelect: selectStudioSection }} />
          </div>
        </QcDocumentPreview>
      </QcDocumentBody>
      <QcDocumentDialogScope><StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />      {/* Add/Edit Item Modal */}
      {showAddItemModal && !editingLineId && (
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

      <ConfirmModal appearance="v2" open={pendingStudioTarget !== null} title="Discard unapplied component changes?"
        description="Display switches are already applied. The component details draft has not been applied."
        confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setPendingStudioTarget(null)}
        onConfirm={() => { const target = pendingStudioTarget; setPendingStudioTarget(null); if (target) goToStudioSection(target); }} />
      {/* Remove line confirmation - replaces native confirm() with app-style modal. */}
      <ConfirmModal appearance="v2"
        open={removeConfirmId !== null}
        title="Remove this item?"
        description="This removes the item from the order. This can't be undone."
        confirmLabel="Remove"
        onCancel={() => setRemoveConfirmId(null)}
        onConfirm={() => { confirmRemoveLine(); if (removeConfirmId === editingLineId) goToStudioSection('items'); }}
      />

      {/* App-style alert replaces native alert() across the order create flow. */}
      <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />
</QcDocumentDialogScope>
    </QcDocumentWorkspace>
  );
}
