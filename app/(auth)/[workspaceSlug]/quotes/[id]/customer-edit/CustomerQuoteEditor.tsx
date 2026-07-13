'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow, CustomerQuoteTemplateRow } from '@/app/lib/types';
import { QuotePreview } from './QuotePreview';
import { AddLineItemModal, type LineItemPayload } from '@/app/components/AddLineItemModal';
import { EditHeaderModal } from './EditHeaderModal';
import { EditFooterModal } from './EditFooterModal';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { saveCustomerQuoteLines, saveCustomerQuoteBranding, updateQuoteMargins } from '../../actions';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { displayLineText } from '@/app/lib/quotes/lineText';
import { CollapsiblePanel, CollapseButton, ExpandTab } from '@/app/components/editor/CollapsiblePanel';
import {
  convertLinear,
  convertArea,
  convertAreaFt2,
} from '@/app/lib/measurements/conversions';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { createCustomerQuoteTemplate } from '../../../customer-quote-templates/create/build/actions';
import { saveQuoteTaxes, seedQuoteTaxesFromCompanyDefaults } from '@/app/lib/taxes/actions';
import { computeTaxLines } from '@/app/lib/taxes/types';
import type { QuoteTaxRow } from '@/app/lib/taxes/types';
import { TaxEditor, type EditableTax } from '@/app/components/TaxEditor';
import { AiUploadModal } from '@/app/components/ai-import/AiUploadModal';
import { AiTextPromptModal } from '@/app/components/ai-import/AiTextPromptModal';
import type { ParsedDocumentResult } from '@/app/components/ai-import/types';

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  components: QuoteComponentRow[];
  savedLines: any[];
  templates: CustomerQuoteTemplateRow[];
  workspaceSlug: string;
  currency: string;
  defaultLogoUrl: string | null;
  disableAutoSave?: boolean; // For labor sheet - no persistence
  editorTitle?: string; // Custom title (default: "Customer Quote Editor")
  previewTitle?: string; // Custom preview title (default: "Customer Quote Preview")
  includeMargins?: boolean; // Whether to include margins in line amounts (default: true)
  customSaveAction?: (quoteId: string, lines: any[]) => Promise<void>; // Custom save function (for labor sheet)
  /** Named component libraries (collections) for the "Add a component" picker. */
  collections?: { id: string; name: string }[];
  /** Full company component library for the "Add a component" picker. */
  componentLibrary?: { id: string; name: string; collection_id: string | null }[];
  /** Catalogs for the "Add from catalog" tab in the Add Line modal. */
  catalogs?: { id: string; name: string }[];
  initialTaxes: QuoteTaxRow[];
  /** Active company-level tax library, shown as a quick "add from defaults" picker. */
  companyTaxes: { id: string; name: string; rate_percent: number }[];
  /** Which include flag drives totals here. Customer-edit uses 'quote'; labor sheet passes 'labor'. */
  taxAudience?: 'quote' | 'labor';
}

interface QuoteLine {
  id: string;
  type: 'component' | 'custom';
  componentId?: string;
  roofAreaId?: string;
  text: string;
  /**
   * Free-text description column (column 2). Separate from the numeric
   * quantity column added by the Quantity Column feature.
   */
  quantityText?: string | null;
  amount: number;
  /** Per-unit price when quantity column is active. Null = legacy. */
  unitPrice?: number | null;
  /** Numeric quantity when quantity column is active. Default 1. */
  qty?: number;
  showPrice: boolean;
  showUnits: boolean;
  isVisible: boolean;
  includeInTotal: boolean;
  sortOrder: number;
  /** Per-line material/profit margin override. Null = use global margin. */
  lineMarginPercent?: number | null;
  /** Per-line labor margin override. Only meaningful for component lines with labour_cost > 0. */
  lineLaborMarginPercent?: number | null;
  /** Raw material cost from the component (component lines only). Used for accurate per-line margin recalculation. */
  baseMaterialCost?: number;
  /** Raw labour cost from the component (component lines only). Used for accurate per-line labor margin recalculation. */
  baseLabourCost?: number;
}

export function CustomerQuoteEditor({ quote, roofAreas, components, savedLines, templates, workspaceSlug, currency, defaultLogoUrl, disableAutoSave: _disableAutoSave = false, editorTitle = "Customer Quote Editor", previewTitle = "Customer Quote Preview", includeMargins = true, customSaveAction, initialTaxes, companyTaxes, taxAudience = 'quote', collections = [], componentLibrary = [], catalogs = [] }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [taxes, setTaxes] = useState<EditableTax[]>(
    initialTaxes.map((t) => ({
      id: t.id,
      dbId: t.id,
      source_tax_id: t.source_tax_id,
      name: t.name,
      rate_percent: Number(t.rate_percent),
      include_in_quote: t.include_in_quote,
      include_in_labor: t.include_in_labor,
    }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  // Quantity column toggle - persisted to quotes.show_quantity_column on save.
  const [showQuantityColumn, setShowQuantityColumn] = useState(
    !!(quote as { show_quantity_column?: boolean }).show_quantity_column
  );
  // Price visibility toggles - persisted to quotes on save.
  const [hideLinePrices, setHideLinePrices] = useState(
    !!(quote as { hide_line_prices?: boolean }).hide_line_prices
  );
  const [hideTotals, setHideTotals] = useState(
    !!(quote as { hide_totals?: boolean }).hide_totals
  );
  // Global margin (material) — blank quotes use global_margin_percent; normal
  // quotes use material_margin_percent from the Review stage. Both are editable
  // in the customer quote editor and sync back on Save.
  const isBlankQuote = (quote as { entry_mode?: string }).entry_mode === 'blank';
  const [globalMarginPercent, setGlobalMarginPercent] = useState<number>(
    isBlankQuote
      ? ((quote as { global_margin_percent?: number | null }).global_margin_percent ?? 0)
      : (quote.material_margin_enabled && quote.material_margin_percent != null
          ? Number(quote.material_margin_percent)
          : 0)
  );
  // Labor margin — editable for all quote types when labor margin is configured.
  // Initialise directly from the DB value regardless of labor_margin_enabled
  // so the pencil editor pre-populates correctly even when the flag was not
  // explicitly set to true (e.g. quotes created before the labor-margin feature).
  const [globalLaborMarginPercent, setGlobalLaborMarginPercent] = useState<number>(
    Number(quote.labor_margin_percent ?? 0)
  );
  const [_laborMarginEnabled, setLaborMarginEnabled] = useState<boolean>(
    Number(quote.labor_margin_percent ?? 0) > 0
  );
  // Only persist margin changes back to the quotes table when the user has
  // explicitly touched the margin sliders in THIS editor session. Without this
  // guard, saving any unrelated change would overwrite Review-stage margin
  // values with the stale initial state (e.g. 0 for old quotes where the
  // margin fields were null).
  const [marginsDirty, setMarginsDirty] = useState(false);
  // Margin visibility warning: shown before "Save & Return" when showMarginInPreview is true.
  const [showMarginSaveWarning, setShowMarginSaveWarning] = useState(false);
  // Used by handleApplyGlobalMargins to pass reset lines into handleSave without
  // fighting React's batched state updates.
  const linesOverrideRef = useRef<QuoteLine[] | null>(null);
  // For non-blank quotes, default to false so the profit margin row is NOT
  // shown to customers unless the user explicitly enables it. Blank quotes
  // previously defaulted to true (kept for backward compat).
  const [showMarginInPreview, setShowMarginInPreview] = useState<boolean>(
    isBlankQuote
      ? ((quote as { show_margin_in_preview?: boolean | null }).show_margin_in_preview ?? true)
      : ((quote as { show_margin_in_preview?: boolean | null }).show_margin_in_preview ?? false)
  );

  // Unified "Add new line" modal (Custom line / Add a component / Search catalog).
  const [showAddLine, setShowAddLine] = useState(false);
  // AI import modals — image upload and text prompt
  const [showAiUpload, setShowAiUpload] = useState(false);
  const [showAiText, setShowAiText] = useState(false);
  const [showEditHeader, setShowEditHeader] = useState(false);
  const [showEditFooter, setShowEditFooter] = useState(false);
  // Declutter: collapse the left controls so the preview fills the space.
  // Pure layout state - the panel stays mounted (no edit/autosave disruption).
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Branding state - use uploaded logo if quote doesn't have one yet
  const [companyName, setCompanyName] = useState(quote.cq_company_name || '');
  const [companyAddress, setCompanyAddress] = useState(quote.cq_company_address || '');
  const [companyPhone, setCompanyPhone] = useState(quote.cq_company_phone || '');
  const [companyEmail, setCompanyEmail] = useState(quote.cq_company_email || '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(quote.cq_company_logo_url || defaultLogoUrl || '');
  const [footerText, setFooterText] = useState(quote.cq_footer_text || '');

  // Initialize lines ONCE on first render. The deps array was previously
  // [savedLines, components], which caused the effect to re-run any time
  // the parent re-rendered (e.g. on router.refresh(), or even on certain
  // child state cascades), because each render produced a fresh array
  // reference for the same content. That re-init wiped in-progress edits
  // - most visibly on blank quotes, where both arrays are empty so the
  // re-init resolved to setLines([]) and silently destroyed the user's
  // custom lines after 3-4 entries (when something upstream triggered a
  // refresh).
  //
  // We use a ref guard rather than removing the effect entirely because the
  // initial population still needs to run on the client side after hydration
  // for new-quote-with-components flows.
  const linesHydratedRef = useRef(false);
  useEffect(() => {
    if (linesHydratedRef.current) return;
    linesHydratedRef.current = true;
    if (savedLines.length > 0) {
      // Load from saved lines, but ALWAYS rebuild component data from current components
      const loadedLines: QuoteLine[] = savedLines.map(saved => {
        if (saved.line_type === 'component') {
          // Component line: rebuild everything from component data
          const component = components.find(c => c.id === saved.quote_component_id);
          if (!component) return null; // Component was deleted

          // Always recalculate from base costs + effective margin settings.
          // Use per-line override (line_margin_percent) when saved, falling back
          // to the quote-level global margin. This ensures amount stays consistent
          // with lineMarginPercent state after a reload.
          const baseMaterialCost = component.material_cost || 0;
          const baseLabourCost = component.labour_cost || 0;
          const globalMatMarginPct = !includeMargins ? 0 : (isBlankQuote
            ? ((quote as { global_margin_percent?: number | null }).global_margin_percent ?? 0)
            : (quote.material_margin_enabled && quote.material_margin_percent != null
                ? Number(quote.material_margin_percent) : 0));
          const globalLabMarginPct = !includeMargins ? 0 : Number(quote.labor_margin_percent ?? 0);

          const savedMarginTyped = saved as {
            line_margin_percent?: number | null;
            line_labor_margin_percent?: number | null;
          };
          // Per-line override wins; null = use global.
          const effectiveMatMargin = savedMarginTyped.line_margin_percent ?? globalMatMarginPct;
          const effectiveLabMargin = savedMarginTyped.line_labor_margin_percent ?? globalLabMarginPct;
          const finalAmount = Math.round(
            (baseMaterialCost * (1 + effectiveMatMargin / 100) + baseLabourCost * (1 + effectiveLabMargin / 100)) * 100
          ) / 100;

          return {
            id: component.id,
            type: 'component' as const,
            componentId: component.id,
            roofAreaId: component.quote_roof_area_id || undefined,
            text: generateDefaultText(component),
            amount: finalAmount,
            showPrice: saved.show_price ?? true,
            showUnits: saved.show_units ?? true,
            isVisible: saved.is_visible ?? true,
            includeInTotal: saved.include_in_total ?? true,
            sortOrder: saved.sort_order,
            lineMarginPercent: savedMarginTyped.line_margin_percent ?? null,
            lineLaborMarginPercent: savedMarginTyped.line_labor_margin_percent ?? null,
            baseMaterialCost: baseMaterialCost,
            baseLabourCost: baseLabourCost,
          };
        } else {
          // Custom line: use saved data. If base_unit_cost was persisted, restore
          // baseMaterialCost so slider recalc stays accurate after reload.
          const savedTyped = saved as {
            quantity_text?: string | null;
            base_unit_cost?: number | null;
            quantity?: number | null;
            unit_price?: number | null;
            line_margin_percent?: number | null;
          };
          const savedQty = savedTyped.quantity ?? 1;
          const savedBaseUnitCost = savedTyped.base_unit_cost ?? null;
          return {
            id: saved.id,
            type: 'custom' as const,
            componentId: undefined,
            roofAreaId: undefined,
            text: saved.custom_text || '',
            quantityText: savedTyped.quantity_text ?? null,
            amount: saved.custom_amount || 0,
            qty: savedQty,
            unitPrice: savedTyped.unit_price ?? null,
            showPrice: saved.show_price ?? true,
            showUnits: saved.show_units ?? true,
            isVisible: saved.is_visible ?? true,
            includeInTotal: saved.include_in_total ?? true,
            sortOrder: saved.sort_order,
            lineMarginPercent: savedTyped.line_margin_percent ?? null,
            // Restore baseMaterialCost from DB so slider recalc is accurate after reload.
            ...(savedBaseUnitCost !== null ? { baseMaterialCost: savedBaseUnitCost * savedQty } : {}),
          };
        }
      }).filter(Boolean) as QuoteLine[];

      // Detect components added to the quote AFTER the customer quote was first
      // saved (e.g. a new component was added in the Review stage). These won't
      // appear in savedLines and need to be surfaced to the user.
      const savedComponentIds = new Set(
        savedLines
          .filter((s: any) => s.line_type === 'component' && s.quote_component_id)
          .map((s: any) => s.quote_component_id as string)
      );
      const missing = components.filter(c => c.is_customer_visible && !savedComponentIds.has(c.id));
      if (missing.length > 0) setMissingComponents(missing);

      setLines(loadedLines);
    } else {
      // Initialize from components (first time) - include margins if enabled
      const initialLines: QuoteLine[] = components
        .filter(c => c.is_customer_visible)
        .map((c, idx) => {
          const baseMaterialCost = c.material_cost || 0;
          const baseLabourCost = c.labour_cost || 0;
          const materialMargin = includeMargins && quote.material_margin_enabled && quote.material_margin_percent
            ? baseMaterialCost * (quote.material_margin_percent / 100)
            : 0;
          const labourMargin = includeMargins && quote.labor_margin_enabled && quote.labor_margin_percent
            ? baseLabourCost * (quote.labor_margin_percent / 100)
            : 0;
          const amountWithMargins = baseMaterialCost + baseLabourCost + materialMargin + labourMargin;

          return {
            id: c.id,
            type: 'component' as const,
            componentId: c.id,
            roofAreaId: c.quote_roof_area_id || undefined,
            text: generateDefaultText(c),
            amount: amountWithMargins,
            showPrice: true,
            showUnits: true,
            isVisible: true,
            includeInTotal: true,
            sortOrder: idx,
            lineMarginPercent: null,
            lineLaborMarginPercent: null,
            baseMaterialCost: baseMaterialCost,
            baseLabourCost: baseLabourCost,
          };
        });
      setLines(initialLines);
    }
  }, [savedLines, components]);

  function generateDefaultText(component: QuoteComponentRow): string {
    // Convert the canonical metric quantity into the quote's display units so
    // the auto-generated customer line matches what the user sees on screen.
    const rawQty = Number(component.final_quantity ?? 0);
    const system = normalizeMeasurementSystem(quote.measurement_system);

    let displayQty = rawQty;
    let unit: string;
    if (component.measurement_type === 'area') {
      if (system === 'imperial_ft') {
        displayQty = convertAreaFt2(rawQty);
        unit = 'ft2';
      } else if (system === 'imperial_rs') {
        displayQty = Number(convertArea(rawQty));
        unit = 'RS';
      } else {
        unit = 'm2';
      }
    } else if (component.measurement_type === 'lineal') {
      if (system === 'imperial_ft' || system === 'imperial_rs') {
        displayQty = convertLinear(rawQty);
        unit = 'ft';
      } else {
        unit = 'm';
      }
    } else {
      // quantity / fixed: no conversion, generic label.
      unit = 'units';
    }

    // Fixed Quantity strategies: format as "Name - 4 (3.42) - 171.07 m2"
    // where 4 = rounded-up purchasable units (priced_quantity),
    // (3.42) = actual fractional units = displayQty / pack_size_snapshot,
    // 171.07 m2 = the real measured area/length/volume.
    // per_unit components (priced_quantity NULL) render exactly as before.
    // Supabase returns `numeric` DB columns as strings at runtime despite the
    // TS types saying number. Use Number() to safely convert before arithmetic.
    const pricedRaw = (component as { priced_quantity?: number | string | null }).priced_quantity;
    const packRaw = (component as { pack_size_snapshot?: number | string | null }).pack_size_snapshot;
    const priced = pricedRaw != null ? Number(pricedRaw) : null;
    const packSnap = packRaw != null ? Number(packRaw) : null;
    if (priced != null && !isNaN(priced) && packSnap != null && !isNaN(packSnap) && packSnap > 0) {
      const fractional = displayQty / packSnap;
      return `${component.name} - ${priced.toFixed(0)} (${fractional.toFixed(2)}) - ${displayQty.toFixed(2)} ${unit}`;
    }

    return `${component.name} - ${displayQty.toFixed(1)} ${unit}`;
  }

  // Editor list always shows the COMPLETE line (description + quantity); the
  // Units toggle only affects the preview / PDF / public output, so we render
  // with showUnits=true here regardless of the line's toggle state.
  function lineDisplay(line: QuoteLine): string {
    return displayLineText(line.text, line.quantityText, true);
  }

  function toggleVisibility(lineId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, isVisible: !l.isVisible } : l
    ));
    setIsDirty(true);
  }

  function toggleShowPrice(lineId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, showPrice: !l.showPrice } : l
    ));
    setIsDirty(true);
  }

  function toggleIncludeInTotal(lineId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, includeInTotal: !l.includeInTotal } : l
    ));
    setIsDirty(true);
  }

  function toggleShowUnits(lineId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, showUnits: !l.showUnits } : l
    ));
    setIsDirty(true);
  }

  function moveUp(lineId: string) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx <= 0) return prev;
      const newLines = [...prev];
      [newLines[idx - 1], newLines[idx]] = [newLines[idx], newLines[idx - 1]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
    setIsDirty(true);
  }

  function moveDown(lineId: string) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const newLines = [...prev];
      [newLines[idx], newLines[idx + 1]] = [newLines[idx + 1], newLines[idx]];
      return newLines.map((l, i) => ({ ...l, sortOrder: i }));
    });
    setIsDirty(true);
  }

  // Fully REMOVE a line from the quote (distinct from "hide", which only flips
  // isVisible). Asks for confirmation via ConfirmModal since it's destructive.
  const [removeLineId, setRemoveLineId] = useState<string | null>(null);
  function removeLine(lineId: string) {
    setLines(prev => prev.filter(l => l.id !== lineId).map((l, i) => ({ ...l, sortOrder: i })));
    if (editingLineId === lineId) setEditingLineId(null);
    setIsDirty(true);
  }

  /** Unified handler: called by AddLineItemModal for all three tabs. */
  function handleAddLineItem(payloads: LineItemPayload[]) {
    // H-01 fix: the user enters a BASE cost (cost price before margin). Apply the
    // current global material margin immediately so the stored amount is the
    // margin-included customer-facing price. Store baseMaterialCost so the global
    // slider and Apply-Global can recompute accurately without proportional guesses.
    const matMargin = globalMarginPercent;
    const newLines: QuoteLine[] = payloads.map((p, i) => {
      const baseCost = p.lineTotal; // total base cost = unitCost * qty
      const marginedAmount = Math.round(baseCost * (1 + matMargin / 100) * 100) / 100;
      const marginedUnitPrice = p.quantity > 0
        ? Math.round((p.unitPrice * (1 + matMargin / 100)) * 100) / 100
        : p.unitPrice;
      return {
        id: `custom-${Date.now()}-${i}`,
        type: 'custom' as const,
        text: p.title,
        quantityText: p.description,
        amount: marginedAmount,
        unitPrice: marginedUnitPrice,
        qty: p.quantity,
        showPrice: p.showPrice,
        showUnits: true,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length + i,
        baseMaterialCost: baseCost,
      };
    });
    setLines(prev => [...prev, ...newLines]);
    setIsDirty(true);
  }

  /**
   * AI Import handler — converts parsed document lines into QuoteLine[] and
   * appends them to the editor. Also updates branding fields if the AI
   * extracted company/client info.
   */
  function handleAiParsed(data: ParsedDocumentResult) {
    const matMargin = globalMarginPercent;
    const newLines: QuoteLine[] = data.lines.map((l, i) => {
      const baseCost = l.qty * l.rate;
      const marginedAmount = Math.round(baseCost * (1 + matMargin / 100) * 100) / 100;
      const marginedUnitPrice = l.qty > 0
        ? Math.round((l.rate * (1 + matMargin / 100)) * 100) / 100
        : l.rate;
      const unitLabel = l.unit ? ` @ ${formatCurrency(l.rate, currency)}/${l.unit}` : '';
      return {
        id: `ai-${Date.now()}-${i}`,
        type: 'custom' as const,
        text: l.description,
        quantityText: l.qty !== 1 || l.unit ? `${l.qty}${l.unit ? ' ' + l.unit : ''}` : null,
        amount: marginedAmount,
        unitPrice: marginedUnitPrice,
        qty: l.qty,
        showPrice: true,
        showUnits: true,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length + i,
        baseMaterialCost: baseCost,
      };
    });
    setLines(prev => [...prev, ...newLines]);
    // Update branding fields if the AI extracted them
    if (data.companyName && !companyName) setCompanyName(data.companyName);
    if (data.clientName && !quote.customer_name) {
      // Can't directly update quote fields from here, but we can at least populate branding
    }
    if (data.notes && !footerText) setFooterText(data.notes);
    setIsDirty(true);
  }

  function updateLine(
    lineId: string,
    text: string,
    quantityText: string | null,
    amount: number,
    showPrice: boolean,
    qty: number = 1,
    unitPrice: number | null = null,
    lineMarginPercent: number | null = null,
    lineLaborMarginPercent: number | null = null,
    newBaseMaterialCost?: number,
  ) {
    setLines(prev => prev.map(l =>
      l.id === lineId
        ? {
            ...l, text, quantityText, amount, showPrice, qty, unitPrice, lineMarginPercent, lineLaborMarginPercent,
            // H-04: update baseMaterialCost when provided so next slider move recalculates from the edited base.
            ...(newBaseMaterialCost !== undefined ? { baseMaterialCost: newBaseMaterialCost } : {}),
          }
        : l
    ));
    setEditingLineId(null);
    setIsDirty(true);
  }

  /**
   * Global margin change handler (Task 3 - blank quotes).
   * Recalculates all lines that DON'T have a per-line override (lineMarginPercent === null).
   * Lines with per-line overrides are left untouched.
   * Formula: new_amount = old_amount / (1 + old_margin/100) × (1 + new_margin/100)
   * Component lines use their baseMaterialCost/baseLabourCost for accurate recalculation.
   */
  function handleGlobalMarginChange(newMargin: number) {
    const oldMargin = globalMarginPercent;
    setGlobalMarginPercent(newMargin);
    setMarginsDirty(true);
    setLines(prev => prev.map(line => {
      // Lines with a per-line override are untouched - the override takes precedence.
      if (line.lineMarginPercent !== null && line.lineMarginPercent !== undefined) return line;
      // Component lines: use true base costs for precision.
      if (line.type === 'component' && line.baseMaterialCost !== undefined && line.baseLabourCost !== undefined) {
        const matMargin = line.lineMarginPercent ?? newMargin;
        // Use the current LABOR margin (not the new material margin) so changing
        // material% doesn't accidentally stomp a different labor% setting.
        const labMargin = line.lineLaborMarginPercent ?? globalLaborMarginPercent;
        const newAmount = Math.round(
          (line.baseMaterialCost * (1 + matMargin / 100) + line.baseLabourCost * (1 + labMargin / 100)) * 100
        ) / 100;
        return { ...line, amount: newAmount };
      }
      // Custom lines with a stored base cost: use direct formula (accurate, no drift).
      if (line.type === 'custom' && line.baseMaterialCost !== undefined) {
        const newAmount = Math.round(line.baseMaterialCost * (1 + newMargin / 100) * 100) / 100;
        return { ...line, amount: newAmount };
      }
      // Proportional fallback for old custom lines without a stored base cost.
      // Works correctly as long as the stored amount was originally set with margin baked in.
      const base = line.amount / (1 + (oldMargin ?? 0) / 100);
      const newAmount = Math.round(base * (1 + newMargin / 100) * 100) / 100;
      return { ...line, amount: newAmount };
    }));
    setIsDirty(true);
  }

  /**
   * Global LABOR margin change handler (all quote types).
   * Recalculates component lines that DON'T have a per-line labor override.
   */
  function handleGlobalLaborMarginChange(newLaborMargin: number) {
    setGlobalLaborMarginPercent(newLaborMargin);
    setMarginsDirty(true);
    setLines(prev => prev.map(line => {
      if (line.type !== 'component') return line;
      if (line.lineLaborMarginPercent !== null && line.lineLaborMarginPercent !== undefined) return line;
      if (line.baseMaterialCost === undefined || line.baseLabourCost === undefined) return line;
      const matMargin = line.lineMarginPercent ?? globalMarginPercent;
      const newAmount = Math.round(
        (line.baseMaterialCost * (1 + matMargin / 100) + line.baseLabourCost * (1 + newLaborMargin / 100)) * 100
      ) / 100;
      return { ...line, amount: newAmount };
    }));
    setIsDirty(true);
  }

  // Derived: any component line with labour cost > 0. Controls the labor margin input.
  const hasLaborLines = lines.some(l => l.type === 'component' && (l.baseLabourCost ?? 0) > 0);

  // Components that exist in the quote but are missing from the customer quote lines
  // (added to the quote after the initial CQL save).
  const [missingComponents, setMissingComponents] = useState<QuoteComponentRow[]>([]);

  function addMissingComponents() {
    const globalMatMarginPct = !includeMargins ? 0 : (isBlankQuote
      ? ((quote as { global_margin_percent?: number | null }).global_margin_percent ?? 0)
      : (quote.material_margin_enabled && quote.material_margin_percent != null
          ? Number(quote.material_margin_percent) : 0));
    const globalLabMarginPct = !includeMargins ? 0 : Number(quote.labor_margin_percent ?? 0);
    const newLines: QuoteLine[] = missingComponents.map((c, idx) => {
      const baseMaterialCost = c.material_cost || 0;
      const baseLabourCost = c.labour_cost || 0;
      const finalAmount = Math.round(
        (baseMaterialCost * (1 + globalMatMarginPct / 100) + baseLabourCost * (1 + globalLabMarginPct / 100)) * 100
      ) / 100;
      return {
        id: c.id,
        type: 'component' as const,
        componentId: c.id,
        roofAreaId: c.quote_roof_area_id || undefined,
        text: generateDefaultText(c),
        amount: finalAmount,
        showPrice: true,
        showUnits: true,
        isVisible: true,
        includeInTotal: true,
        sortOrder: lines.length + idx,
        lineMarginPercent: null,
        lineLaborMarginPercent: null,
        baseMaterialCost,
        baseLabourCost,
      };
    });
    setLines(prev => [...prev, ...newLines].map((l, i) => ({ ...l, sortOrder: i })));
    setMissingComponents([]);
    setIsDirty(true);
  }

  /**
   * Apply & Save: resets ALL line-level margin overrides to global, recalculates
   * every component line amount, then saves immediately. This sets a clean
   * global baseline — per-line edits can happen after.
   */
  async function handleApplyGlobalMargins() {
    // C-01 fix: clear all per-line margin overrides AND recompute amounts from
    // base costs so the saved custom_amount matches the current global margin.
    // Lines with per-line overrides were NOT updated by the live slider, so their
    // stored amounts still reflect the old override — recompute them now.
    const resetLines = lines.map(line => {
      const base = {
        ...line,
        lineMarginPercent: null as null,
        lineLaborMarginPercent: null as null,
      };
      // Component lines: recompute from true base costs.
      if (line.type === 'component' && line.baseMaterialCost !== undefined && line.baseLabourCost !== undefined) {
        const newAmount = Math.round(
          (line.baseMaterialCost * (1 + globalMarginPercent / 100) + line.baseLabourCost * (1 + globalLaborMarginPercent / 100)) * 100
        ) / 100;
        return { ...base, amount: newAmount };
      }
      // Custom lines with stored base cost (added after patch-018): recompute directly.
      if (line.type === 'custom' && line.baseMaterialCost !== undefined) {
        const newAmount = Math.round(line.baseMaterialCost * (1 + globalMarginPercent / 100) * 100) / 100;
        return { ...base, amount: newAmount };
      }
      // Old custom lines without a stored base cost: use proportional math to
      // convert from the override price to the new global margin price.
      if (line.lineMarginPercent !== null && line.lineMarginPercent !== undefined) {
        const impliedBase = line.amount / (1 + line.lineMarginPercent / 100);
        const newAmount = Math.round(impliedBase * (1 + globalMarginPercent / 100) * 100) / 100;
        return { ...base, amount: newAmount };
      }
      return base;
    });
    linesOverrideRef.current = resetLines;
    setLines(resetLines);
    setMarginsDirty(true);
    setIsDirty(true);
    await handleSave();
  }

  function applyTemplate(templateId: string) {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Apply branding from template
    setCompanyName(template.company_name || '');
    setCompanyAddress(template.company_address || '');
    setCompanyPhone(template.company_phone || '');
    setCompanyEmail(template.company_email || '');
    setCompanyLogoUrl(template.company_logo_url || defaultLogoUrl || '');
    setFooterText(template.footer_text || '');

    setIsDirty(true);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const lineData = (linesOverrideRef.current ?? lines).map(line => ({
        id: line.id,
        lineType: line.type,
        componentId: line.componentId,
        text: line.text,
        quantityText: line.quantityText ?? null,
        amount: line.amount,
        showPrice: line.showPrice,
        showUnits: line.showUnits,
        sortOrder: line.sortOrder,
        isVisible: line.isVisible,
        includeInTotal: line.includeInTotal,
        quantity: line.qty ?? 1,
        unitPrice: line.unitPrice ?? null,
        lineMarginPercent: line.lineMarginPercent ?? null,
        lineLaborMarginPercent: line.lineLaborMarginPercent ?? null,
        // Persist base unit cost for custom lines so reload can accurately recalculate.
        baseUnitCost: (line.type === 'custom' && line.baseMaterialCost !== undefined && (line.qty ?? 1) > 0)
          ? line.baseMaterialCost / (line.qty ?? 1)
          : null,
      }));
      // Persist the show_quantity_column + price-visibility toggles alongside lines
      const showQtyCol = showQuantityColumn;
      const hideLinePricesVal = hideLinePrices;
      const hideTotalsVal = hideTotals;

      // Use custom save action if provided (for labor sheet), otherwise use default
      const saveLineAction = customSaveAction || saveCustomerQuoteLines;

      // Validate taxes before save so we don't half-write.
      for (const t of taxes) {
        if (!t.name.trim()) throw new Error('Each tax must have a name');
        if (!Number.isFinite(t.rate_percent) || t.rate_percent < 0 || t.rate_percent > 100) {
          throw new Error(`Invalid rate for "${t.name}": must be between 0 and 100`);
        }
      }

      // Persist margin settings back to the quotes table so they stay in sync
      // with the Review stage values. For blank quotes, global_margin_percent is
      // used; for normal quotes, material_margin_percent + labor_margin_percent.
      const materialEnabled = globalMarginPercent > 0;
      const laborEnabled = (linesOverrideRef.current ?? lines).some(l => l.type === 'component' && (l.baseLabourCost ?? 0) > 0) && globalLaborMarginPercent > 0;
      await Promise.all([
        saveLineAction(quote.id, lineData, showQtyCol, hideLinePricesVal, hideTotalsVal, isBlankQuote && globalMarginPercent > 0 ? globalMarginPercent : null, showMarginInPreview),
        // Only update when user actually changed margins this session (marginsDirty).
          // Without this guard, unrelated saves overwrite Review-stage values.
          isBlankQuote || !marginsDirty
          ? Promise.resolve()
          : updateQuoteMargins(
              quote.id,
              {
                materialMarginEnabled: materialEnabled,
                materialMarginPercent: materialEnabled ? globalMarginPercent : null,
                laborMarginEnabled: laborEnabled,
                laborMarginPercent: laborEnabled ? globalLaborMarginPercent : null,
              },
            ),
        saveCustomerQuoteBranding(quote.id, {
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          companyLogoUrl,
          footerText,
        }),
        saveQuoteTaxes(
          quote.id,
          taxes.map((t, idx) => ({
            id: t.dbId,
            source_tax_id: t.source_tax_id ?? null,
            name: t.name,
            rate_percent: Number(t.rate_percent),
            sort_order: idx,
            include_in_quote: t.include_in_quote ?? true,
            include_in_labor: t.include_in_labor ?? true,
          }))
        ),
      ]);
      setLastSaved(new Date());
      setIsDirty(false);
      linesOverrideRef.current = null;
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [quote.id, lines, taxes, showQuantityColumn, hideLinePrices, hideTotals, globalMarginPercent, globalLaborMarginPercent, isBlankQuote, showMarginInPreview, companyName, companyAddress, companyPhone, companyEmail, companyLogoUrl, footerText, customSaveAction]);

  // Auto-save removed per user request

  // Group lines by roof area
  const linesByArea = lines.reduce((acc, line) => {
    const areaId = line.roofAreaId || 'extras';
    if (!acc[areaId]) acc[areaId] = [];
    acc[areaId].push(line);
    return acc;
  }, {} as Record<string, QuoteLine[]>);

  // Phase 5: trade-aware label for the "no area" bucket. A generic-trade
  // quote with zero areas puts everything in the 'extras' bucket by design,
  // and the existing "Extras & Custom" heading reads wrong in that case.
  // Use "Quote items" instead. Roofing quotes (or generic quotes that DO
  // have areas) keep the existing label.
  // quote.trade was added in Phase 2; database.types.ts hasn't been
  // regenerated yet, so cast at the boundary.
  const quoteTrade = (quote as { trade?: 'roofing' | 'generic' | null }).trade ?? 'roofing';
  const isGenericNoArea = quoteTrade === 'generic' && roofAreas.length === 0;
  const extrasBucketHeading = isGenericNoArea ? 'Quote items' : 'Extras & Custom';

  const visibleLines = lines.filter(l => l.isVisible);
  const subtotal = lines.filter(l => l.includeInTotal).reduce((sum, l) => sum + l.amount, 0); // Only include items with "Add $" checked

  // Margin display amounts for the preview breakdown rows.
  // Uses per-line override when set (lineMarginPercent / lineLaborMarginPercent),
  // falling back to the global slider value — so pencil-edited lines contribute
  // their actual margin rather than the global rate.
  const materialMarginTotal = lines
    .filter(l => l.type === 'component' && l.baseMaterialCost !== undefined)
    .reduce((sum, l) => sum + (l.baseMaterialCost! * (l.lineMarginPercent ?? globalMarginPercent) / 100), 0);
  const labourMarginTotal = lines
    .filter(l => l.type === 'component' && l.baseLabourCost !== undefined)
    .reduce((sum, l) => sum + (l.baseLabourCost! * (l.lineLaborMarginPercent ?? globalLaborMarginPercent) / 100), 0);
  const { lines: taxLines, total: taxTotal } = computeTaxLines(
    taxes.map((t) => ({
      id: t.id,
      name: t.name,
      rate_percent: t.rate_percent,
      include_in_quote: t.include_in_quote ?? true,
      include_in_labor: t.include_in_labor ?? true,
    })),
    subtotal,
    taxAudience
  );
  const total = subtotal + taxTotal;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${workspaceSlug}/quotes/${quote.id}/summary`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Back
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">
              {editorTitle} - Quote #{quote.quote_number || 'Draft'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Header template dropdown - always visible */}
            <select
                onChange={(e) => {
                  if (e.target.value) {
                    applyTemplate(e.target.value);
                    e.target.value = '';
                  }
                }}
                data-copilot="cl-template-dropdown"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-full focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="">{templates.length > 0 ? 'Load Template...' : 'No templates saved'}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            {/* Edit Header button */}
            <button
              type="button"
              onClick={() => setShowEditHeader(true)}
              title="Edit company name, logo, and header details"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
              </svg>
              Edit Header
            </button>
            {/* Edit Footer button */}
            <button
              type="button"
              onClick={() => setShowEditFooter(true)}
              title="Edit footer text and notes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Edit Footer
            </button>
            {/* AI import buttons — image upload + text prompt */}
            <button
              type="button"
              onClick={() => setShowAiUpload(true)}
              title="Upload image or pdf to transfer into a quote"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => setShowAiText(true)}
              title="Write or copy and paste quote details"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Text Prompt
            </button>
            <div className="text-sm text-slate-500">
              {saving ? 'Saving...' : lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : 'Not saved yet'}
              {isDirty && !saving && ' (unsaved changes)'}
            </div>
          </div>
        </div>

        {/* Two-panel layout. Flex row (was a 2-col grid) so the left controls
            can collapse and the preview (flex-1) smoothly fills the freed
            space. Visually identical to the old 50/50 grid when expanded
            (left keeps a 1fr-equivalent basis). */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Panel: Component Selection - collapsible to declutter. Fixed
              basis (not 1fr) so the PREVIEW is the dominant section, matching
              the order editors; on collapse the preview goes full width. */}
          <CollapsiblePanel collapsed={panelCollapsed} widthClass="lg:w-[420px] lg:flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-copilot="cl-left-panel">
            <div className="flex items-center gap-2">
              <CollapseButton
                collapsed={panelCollapsed}
                onToggle={() => setPanelCollapsed(true)}
                label="Collapse panel"
              />
              <h2 className="text-lg font-semibold text-slate-900">Components & Items</h2>
            </div>
            <p className="text-xs text-slate-400">
              Easily click/unclick what you want to see or hide from your quote below
            </p>

            {/* Column/price visibility toggles - above the lines list */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pb-1 border-b border-slate-100">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showQuantityColumn}
                  onChange={(e) => { setShowQuantityColumn(e.target.checked); setIsDirty(true); }}
                  className="w-3.5 h-3.5 rounded text-orange-600"
                />
                <span className="text-xs text-slate-500">Qty column</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideLinePrices}
                  onChange={(e) => { setHideLinePrices(e.target.checked); setIsDirty(true); }}
                  className="w-3.5 h-3.5 rounded text-orange-600"
                />
                <span className="text-xs text-slate-500">Hide line prices</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideTotals}
                  onChange={(e) => { setHideTotals(e.target.checked); setIsDirty(true); }}
                  className="w-3.5 h-3.5 rounded text-orange-600"
                />
                <span className="text-xs text-slate-500">Hide totals</span>
              </label>
            </div>

            <div className="space-y-4">
              {/* Grouped by roof areas */}
              {roofAreas.map(area => {
                const areaLines = linesByArea[area.id] || [];
                if (areaLines.length === 0) return null;
                return (
                  <div key={area.id} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700 px-2">{area.label}</h3>
                    {areaLines.map(line => (
                      <div
                        key={line.id}
                        className={`px-2 py-1.5 rounded-lg border ${
                          line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`text-sm ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                                {lineDisplay(line)}
                              </p>
                              <p className={`text-sm font-medium ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                                {formatCurrency(line.amount, currency)}
                              </p>
                            </div>
                            {/* Horizontal checkbox row - directly below component details */}
                            <div className="flex items-center gap-4 mt-1">
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.isVisible}
                                  onChange={() => toggleVisibility(line.id)}
                                  className="toggle-dot"
                                />
                                Show
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.showPrice}
                                  onChange={() => toggleShowPrice(line.id)}
                                  disabled={!line.isVisible}
                                  className="toggle-dot"
                                />
                                Price
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.showUnits}
                                  onChange={() => toggleShowUnits(line.id)}
                                  disabled={!line.isVisible}
                                  className="toggle-dot"
                                />
                                Units
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.includeInTotal}
                                  onChange={() => toggleIncludeInTotal(line.id)}
                                  className="toggle-dot"
                                />
                                Add $
                              </label>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setRemoveLineId(line.id)}
                              title="Remove this line"
                              aria-label="Remove line"
                              className="p-0.5 text-red-400 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <button
                              onClick={() => moveUp(line.id)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                              disabled={line.sortOrder === 0}
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveDown(line.id)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                              disabled={line.sortOrder === lines.length - 1}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Extras / ungrouped (Phase 5: trade-aware heading) */}
              {linesByArea['extras'] && linesByArea['extras'].length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 px-2">{extrasBucketHeading}</h3>
                  {linesByArea['extras'].map(line => (
                    <div
                      key={line.id}
                      className={`px-2 py-1.5 rounded-lg border ${
                        line.isVisible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm ${line.isVisible ? 'text-slate-900' : 'text-slate-400'}`}>
                              {lineDisplay(line)}
                            </p>
                            <p className={`text-sm font-medium ${line.isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                              {formatCurrency(line.amount, currency)}
                            </p>
                          </div>
                          {/* Horizontal checkbox row - directly below component details */}
                          <div className="flex items-center gap-4 mt-1">
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.isVisible}
                                onChange={() => toggleVisibility(line.id)}
                                className="toggle-dot"
                              />
                              Show
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.showPrice}
                                onChange={() => toggleShowPrice(line.id)}
                                disabled={!line.isVisible}
                                className="toggle-dot"
                              />
                              Price
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.showUnits}
                                onChange={() => toggleShowUnits(line.id)}
                                disabled={!line.isVisible}
                                className="toggle-dot"
                              />
                              Units
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={line.includeInTotal}
                                onChange={() => toggleIncludeInTotal(line.id)}
                                className="toggle-dot"
                              />
                              Add $
                            </label>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setRemoveLineId(line.id)}
                            title="Remove this line"
                            aria-label="Remove line"
                            className="p-0.5 text-red-400 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          <button
                            onClick={() => moveUp(line.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            disabled={line.sortOrder === 0}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveDown(line.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            disabled={line.sortOrder === lines.length - 1}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              data-copilot="cl-add-line-btn"
              onClick={() => setShowAddLine(true)}
              className="w-full py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-full hover:bg-orange-50 hover:border-orange-300 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]"
            >
              + Add New Line
            </button>

            {/* Missing components banner — shown when components were added after initial CQL save */}
            {missingComponents.length > 0 && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-800">
                    {missingComponents.length} component{missingComponents.length !== 1 ? 's' : ''} not in your quote
                  </p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    {missingComponents.map(c => c.name).join(', ')}
                  </p>
                  <button
                    type="button"
                    onClick={addMissingComponents}
                    className="mt-2 text-xs font-medium text-orange-700 underline hover:text-orange-900"
                  >
                    Add to quote
                  </button>
                </div>
              </div>
            )}

            {/* Profit Margin — all quote types. Blank quotes: single global %. Normal
              quotes: separate material + labor %. Saves back to the quote
              record on Save so the Review stage stays in sync. */}
            <div className="pt-4 border-t space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Profit Margin</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isBlankQuote
                    ? 'Applies a global markup to all line prices.'
                    : 'Item Cost and labour margins applied to all lines. Per-line overrides available via the pencil editor.'}
                </p>
              </div>

              {/* Material margin */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-600 whitespace-nowrap w-24">
                  {isBlankQuote ? 'Global' : 'Item Cost'} margin
                </label>
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="0.5"
                    value={globalMarginPercent}
                    onChange={e => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      handleGlobalMarginChange(val);
                    }}
                    className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>

              {/* Labor margin — always visible for normal quotes; disabled when no labour lines exist */}
              {!isBlankQuote && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 whitespace-nowrap w-24">
                    Labor margin
                  </label>
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="0.5"
                      value={globalLaborMarginPercent}
                      disabled={!hasLaborLines}
                      onChange={e => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setLaborMarginEnabled(val > 0);
                        handleGlobalLaborMarginChange(val);
                      }}
                      className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:border-orange-500 focus:outline-none disabled:opacity-40 disabled:bg-slate-50"
                    />
                    <span className={`text-sm ${hasLaborLines ? 'text-slate-500' : 'text-slate-400'}`}>%</span>
                    {!hasLaborLines && (
                      <span className="text-xs text-slate-400 italic">no labour lines</span>
                    )}
                  </div>
                </div>
              )}

              {/* Show on customer quote toggle — available for all quote types */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showMarginInPreview}
                  onChange={e => { setShowMarginInPreview(e.target.checked); setIsDirty(true); }}
                  className="w-3.5 h-3.5 rounded text-orange-600"
                />
                <span className="text-xs text-slate-500">Show margin breakdown on customer quote</span>
              </label>

              {/* Apply Global Margins & Save — resets ALL per-line overrides to global baseline */}
              <button
                type="button"
                onClick={handleApplyGlobalMargins}
                disabled={saving}
                className="w-full py-2 text-sm font-medium bg-[#FF6B35] text-white rounded-full hover:bg-orange-600 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : 'Apply Global Margins & Save'}
              </button>
              <p className="text-xs text-slate-400">
                Resets all per-line overrides to these global values and saves immediately.
              </p>
            </div>

            {/* Taxes */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Taxes</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Toggle which taxes apply on this quote and edit their rates without
                    changing your company defaults. Multiple taxes stack on the customer total.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Reset taxes on this quote to the current company defaults? Any per-quote edits will be lost.')) return;
                    await seedQuoteTaxesFromCompanyDefaults(quote.id);
                    router.refresh();
                  }}
                  className="text-xs text-slate-500 hover:text-orange-600 underline whitespace-nowrap"
                >
                  Reset to defaults
                </button>
              </div>
              <TaxEditor
                taxes={taxes}
                onChange={(next) => { setTaxes(next); setIsDirty(true); }}
                showAudienceToggles
                disabled={saving}
              />

              {companyTaxes.length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Apply default taxes
                  </p>
                  <p className="text-xs text-slate-500 mb-2">
                    Tick to apply, untick to remove. Edits below stay scoped to this quote
                    and never change your company defaults.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {companyTaxes.map((ct) => {
                      const applied = taxes.some(
                        (t) => t.source_tax_id === ct.id || (!t.source_tax_id && t.dbId === ct.id)
                      );
                      return (
                        <button
                          type="button"
                          key={ct.id}
                          onClick={() => {
                            setIsDirty(true);
                            if (applied) {
                              setTaxes(taxes.filter(
                                (t) => t.source_tax_id !== ct.id && t.dbId !== ct.id
                              ));
                            } else {
                              setTaxes([
                                ...taxes,
                                {
                                  id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                  source_tax_id: ct.id,
                                  name: ct.name,
                                  rate_percent: ct.rate_percent,
                                  include_in_quote: true,
                                  include_in_labor: true,
                                },
                              ]);
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                            applied
                              ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50'
                          }`}
                          title={applied ? 'Click to remove from this quote' : 'Click to apply to this quote'}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`inline-block w-3 h-3 rounded-sm border ${
                                applied ? 'bg-orange-500 border-orange-500' : 'border-slate-400 bg-white'
                              }`}
                            >
                              {applied && (
                                <svg viewBox="0 0 16 16" className="w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5l3 3 7-7" />
                                </svg>
                              )}
                            </span>
                            {ct.name} ({ct.rate_percent}%)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-slate-500">
                {saving ? 'Saving...' : lastSaved ? `Auto-saved ${Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago` : 'Not saved yet'}
              </p>
              <button
                onClick={async () => {
                  if (showMarginInPreview) {
                    setShowMarginSaveWarning(true);
                    return;
                  }
                  await handleSave();
                  router.push(`/${workspaceSlug}/quotes/${quote.id}/summary`);
                }}
                disabled={saving}
                data-copilot="cl-save-return"
                className="w-full py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {saving ? 'Saving...' : 'Save & Return to Summary'}
              </button>
              <button
                onClick={async () => {
                  const name = prompt('Template name:', `${quote.customer_name} - Branding Template`);
                  if (!name) return;

                  try {
                    await createCustomerQuoteTemplate({
                      name,
                      companyName,
                      companyAddress,
                      companyPhone,
                      companyEmail,
                      footerText,
                      companyLogoUrl: companyLogoUrl || null,
                    });
                    alert(`Template "${name}" saved successfully!`);
                  } catch (error) {
                    alert('Failed to save template: ' + (error as Error).message);
                  }
                }}
                className="w-full py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-full hover:bg-slate-50"
              >
                Save Branding as Template
              </button>
            </div>
          </div>

          </CollapsiblePanel>

          {/* Expand tab - only visible when collapsed; on the preview side so
              it is never clipped by the collapsing panel's overflow. */}
          <ExpandTab
            collapsed={panelCollapsed}
            onToggle={() => setPanelCollapsed(false)}
            label="Components"
          />

          {/* Right Panel: Live Preview - expands to fill when left collapses. */}
          <div
            className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 w-full lg:flex-1 lg:min-w-0"
            data-copilot="cl-right-panel"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{previewTitle}</h2>
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50"
              >
                Preview Full Size
              </button>
            </div>

            <div className="border-t pt-4">
              <QuotePreview
                quote={quote}
                lines={visibleLines}
                subtotal={subtotal}
                taxLines={taxLines}
                taxTotal={taxTotal}
                total={total}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyEmail={companyEmail}
                companyLogoUrl={companyLogoUrl}
                footerText={footerText}
                editingLineId={editingLineId}
                onEditLine={setEditingLineId}
                onSaveLine={(id, text, quantityText, amount, sp, qty, unitPrice, lineMarginPercent, lineLaborMarginPercent, bmc) =>
                  updateLine(id, text, quantityText, amount, sp, qty ?? 1, unitPrice ?? null, lineMarginPercent ?? null, lineLaborMarginPercent ?? null, bmc)
                }
                showQuantityColumn={showQuantityColumn}
                hideLinePrices={hideLinePrices}
                hideTotals={hideTotals}
                onCancelEdit={() => setEditingLineId(null)}
                onEditHeader={() => setShowEditHeader(true)}
                onEditFooter={() => setShowEditFooter(true)}
                currency={currency}
                globalMarginPercent={globalMarginPercent > 0 ? globalMarginPercent : null}
                globalLaborMarginPercent={hasLaborLines && globalLaborMarginPercent > 0 ? globalLaborMarginPercent : 0}
                showMarginInPreview={showMarginInPreview}
                materialMarginDisplay={showMarginInPreview && globalMarginPercent > 0 ? materialMarginTotal : null}
                labourMarginDisplay={showMarginInPreview && hasLaborLines && globalLaborMarginPercent > 0 ? labourMarginTotal : null}
                quoteEntryMode={(quote as { entry_mode?: string }).entry_mode ?? null}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-size Preview Modal */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Full Size Preview</h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8 pt-12">
              <QuotePreview
                quote={quote}
                lines={visibleLines}
                subtotal={subtotal}
                taxLines={taxLines}
                taxTotal={taxTotal}
                total={total}
                companyName={companyName}
                companyAddress={companyAddress}
                companyPhone={companyPhone}
                companyEmail={companyEmail}
                companyLogoUrl={companyLogoUrl}
                footerText={footerText}
                showEditButtons={false}
                currency={currency}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Header Modal */}
      {showEditHeader && (
        <EditHeaderModal
          companyName={companyName}
          companyAddress={companyAddress}
          companyPhone={companyPhone}
          companyEmail={companyEmail}
          companyLogoUrl={companyLogoUrl}
          onSave={(data) => {
            setCompanyName(data.companyName);
            setCompanyAddress(data.companyAddress);
            setCompanyPhone(data.companyPhone);
            setCompanyEmail(data.companyEmail);
            setCompanyLogoUrl(data.companyLogoUrl);
            setIsDirty(true);
            setShowEditHeader(false);
          }}
          onCancel={() => setShowEditHeader(false)}
          onSaveAsTemplate={async (data) => {
            const name = prompt('Template name:', `${data.companyName || 'My Company'} - Branding Template`);
            if (!name) return;
            try {
              await createCustomerQuoteTemplate({
                name,
                companyName: data.companyName,
                companyAddress: data.companyAddress,
                companyPhone: data.companyPhone,
                companyEmail: data.companyEmail,
                footerText,
                companyLogoUrl: data.companyLogoUrl || null,
              });
              alert(`Template "${name}" saved successfully!`);
            } catch (error) {
              alert('Failed to save template: ' + (error as Error).message);
            }
          }}
        />
      )}

      {/* Edit Footer Modal */}
      {showEditFooter && (
        <EditFooterModal
          footerText={footerText}
          onSave={(text) => {
            setFooterText(text);
            setIsDirty(true);
            setShowEditFooter(false);
          }}
          onCancel={() => setShowEditFooter(false)}
        />
      )}

      {/* Unified Add Line Item modal: Custom / Catalog / Component */}
      {showAddLine && (
        <AddLineItemModal
          workspaceSlug={workspaceSlug}
          currency={currency}
          catalogs={catalogs}
          collections={collections}
          componentLibrary={componentLibrary}
          onAdd={handleAddLineItem}
          onClose={() => setShowAddLine(false)}
        />
      )}

      {/* Remove-line confirmation (destructive: fully deletes the line). */}
      <ConfirmModal
        open={removeLineId !== null}
        title="Remove this line?"
        description="This removes the line from the quote entirely. To keep it but hide it from the customer, use the Show toggle instead."
        confirmLabel="Remove"
        onCancel={() => setRemoveLineId(null)}
        onConfirm={() => {
          if (removeLineId) removeLine(removeLineId);
          setRemoveLineId(null);
        }}
      />

      {/* Margin visibility warning — shown before Save & Return when breakdown is customer-visible */}
      <ConfirmModal
        open={showMarginSaveWarning}
        title="Margin breakdown is visible to the customer"
        description={`Your profit/margin breakdown is currently set to show on the customer quote. The customer will be able to see your margin values.\n\nTo hide it, uncheck "Show margin breakdown on customer quote" in the Profit Margin panel before saving.`}
        confirmLabel="Save anyway"
        cancelLabel="Go back"
        destructive={false}
        onCancel={() => setShowMarginSaveWarning(false)}
        onConfirm={async () => {
          setShowMarginSaveWarning(false);
          await handleSave();
          router.push(`/${workspaceSlug}/quotes/${quote.id}/summary`);
        }}
      />

      {/* AI import modals */}
      {showAiUpload && (
        <AiUploadModal
          documentType="quote"
          onParsed={handleAiParsed}
          onClose={() => setShowAiUpload(false)}
        />
      )}
      {showAiText && (
        <AiTextPromptModal
          documentType="quote"
          onParsed={handleAiParsed}
          onClose={() => setShowAiText(false)}
        />
      )}
    </div>
  );
}
