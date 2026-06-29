'use server';

// Quote -> Line-by-line ENVELOPE loader (Decision #4, 2026-06-05).
//
// When a material order is created from a quote in the LINE-BY-LINE layout,
// Shaun's requirement is that it pre-populates EXACTLY like the customer quote
// editor does: the same priced lines, descriptions, show/price/in-total flags,
// footer, and taxes the customer quote would have shown.
//
// To guarantee 1:1 parity WITHOUT coupling the order editor to the quote
// schema (and without touching the custom blank line-by-line path), this loader
// replicates the CustomerQuoteEditor's line-init logic on the server and emits
// a ready-to-hydrate { lines, footer, taxes } LineByLineData envelope:
//   - saved customer_quote_lines win (priced, with overrides) when present;
//   - otherwise margin-applied component lines (customer-visible only);
//   - footer = quote.cq_footer_text;
//   - taxes = the quote's taxes (include_in_quote only).
//
// This mirrors CustomerQuoteEditor.tsx (line-init effect + generateDefaultText)
// and loadQuoteTaxes. Keep them in sync if the quote editor's mapping changes.

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { normalizeMeasurementSystem, type MeasurementSystem } from '@/app/lib/types';
import { convertLinear, convertArea, convertAreaFt2 } from '@/app/lib/measurements/conversions';
import type { LineByLineData, LineByLineItem } from '../lineByLine';

/** Build the customer-facing default text for a component line (mirrors
 *  CustomerQuoteEditor.generateDefaultText): "<name> - <qty> <unit>". */
function generateDefaultText(
  comp: { name: string; final_quantity: number | null; measurement_type: string | null },
  measurementSystem: string | null,
): string {
  const rawQty = Number(comp.final_quantity ?? 0);
  const system = normalizeMeasurementSystem(measurementSystem as MeasurementSystem | null);

  let displayQty = rawQty;
  let unit: string;
  if (comp.measurement_type === 'area') {
    if (system === 'imperial_ft') {
      displayQty = convertAreaFt2(rawQty);
      unit = 'ft²';
    } else if (system === 'imperial_rs') {
      displayQty = Number(convertArea(rawQty));
      unit = 'RS';
    } else {
      unit = 'm²';
    }
  } else if (comp.measurement_type === 'lineal') {
    if (system === 'imperial_ft' || system === 'imperial_rs') {
      displayQty = convertLinear(rawQty);
      unit = 'ft';
    } else {
      unit = 'm';
    }
  } else {
    unit = 'units';
  }

  return `${comp.name} - ${displayQty.toFixed(1)} ${unit}`;
}

/**
 * Load a quote and produce a line-by-line envelope that matches what the
 * customer quote editor would render. Returns null if the quote is missing or
 * has no customer-visible content (caller falls back to an empty editor).
 */
export async function loadQuoteLineByLineData(
  quoteId: string,
  selectedComponentIds?: string[] | null,
): Promise<LineByLineData | null> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Quote header (margins, measurement system, footer, currency-irrelevant here).
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(
        'id, company_id, measurement_system, material_margin_enabled, material_margin_percent, labor_margin_enabled, labor_margin_percent, cq_footer_text',
      )
      // (quote taxes intentionally NOT loaded - orders default to no tax)
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();

    if (quoteError || !quote) {
      console.error('[quote-lbl-loader] Quote not found:', quoteError);
      return null;
    }

    // Components (priced) + saved customer lines (overrides/flags), in parallel.
    const [{ data: components }, { data: savedLines }] = await Promise.all([
      supabase.from('quote_components').select('*').eq('quote_id', quoteId).order('sort_order', { ascending: true }),
      supabase
        .from('customer_quote_lines')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true }),
    ]);

    // Apply the line-selector filter when the user pre-selected which components
    // to include. Custom lines (type !== 'component') always pass through.
    const allComps = components || [];
    const comps = selectedComponentIds
      ? allComps.filter((c: any) => selectedComponentIds.includes(c.id))
      : allComps;
    const selectedSet = selectedComponentIds ? new Set(selectedComponentIds) : null;
    const allSaved = savedLines || [];
    const saved = selectedSet
      ? allSaved.filter((s: any) =>
          s.line_type !== 'component' || !s.quote_component_id || selectedSet.has(s.quote_component_id)
        )
      : allSaved;

    const materialMarginPct =
      quote.material_margin_enabled && quote.material_margin_percent ? quote.material_margin_percent : 0;
    const labourMarginPct =
      quote.labor_margin_enabled && quote.labor_margin_percent ? quote.labor_margin_percent : 0;

    const amountForComponent = (comp: {
      material_cost: number | null;
      labour_cost: number | null;
    }): number => {
      const baseMaterial = comp.material_cost || 0;
      const baseLabour = comp.labour_cost || 0;
      const materialMargin = baseMaterial * (materialMarginPct / 100);
      const labourMargin = baseLabour * (labourMarginPct / 100);
      return baseMaterial + baseLabour + materialMargin + labourMargin;
    };

    let lines: LineByLineItem[] = [];

    if (saved.length > 0) {
      // Saved lines win - mirror CustomerQuoteEditor's loadedLines mapping.
      lines = saved
        .map((s: any, idx: number): LineByLineItem | null => {
          if (s.line_type === 'component') {
            const comp = comps.find((c: any) => c.id === s.quote_component_id);
            if (!comp) return null; // component deleted since the quote was built
            const calculated = amountForComponent(comp);
            const hasCustom = s.custom_amount != null && s.custom_amount !== calculated;
            const amount = hasCustom ? Number(s.custom_amount) : calculated;
            return {
              id: `q-${comp.id}`,
              text: generateDefaultText(comp, quote.measurement_system),
              quantityText: null,
              amount,
              unitPrice: null,
              quantity: 1,
              showPrice: s.show_price ?? true,
              isVisible: s.is_visible ?? true,
              includeInTotal: s.include_in_total ?? true,
              sortOrder: typeof s.sort_order === 'number' ? s.sort_order : idx,
            };
          }
          // Custom line - use the saved data verbatim.
          return {
            id: `q-${s.id}`,
            text: s.custom_text || '',
            quantityText: (s.quantity_text as string | null) ?? null,
            amount: Number(s.custom_amount || 0),
            unitPrice: (s.unit_price as number | null) ?? null,
            quantity: (s.quantity as number) ?? 1,
            showPrice: s.show_price ?? true,
            isVisible: s.is_visible ?? true,
            includeInTotal: s.include_in_total ?? true,
            sortOrder: typeof s.sort_order === 'number' ? s.sort_order : idx,
          };
        })
        .filter((x): x is LineByLineItem => x !== null);
    } else {
      // No saved lines - initialise from customer-visible components (margins on).
      lines = comps
        .filter((c: any) => c.is_customer_visible)
        .map((c: any, idx: number): LineByLineItem => ({
          id: `q-${c.id}`,
          text: generateDefaultText(c, quote.measurement_system),
          quantityText: null,
          amount: amountForComponent(c),
          unitPrice: null,
          quantity: 1,
          showPrice: true,
          isVisible: true,
          includeInTotal: true,
          sortOrder: idx,
        }));
    }

    // Re-sort + re-index so sortOrder is dense (the editor commits dense indexes).
    lines = lines
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l, i) => ({ ...l, sortOrder: i }));

    if (lines.length === 0) return null;

    // Taxes: orders default to NO tax (same as the custom blank line-by-line
    // path). The user opts in via the editor's tax controls. We deliberately do
    // NOT carry the quote's taxes across, even though the priced lines come from
    // the quote - Shaun: order-from-quote must start tax-free by default.
    return {
      lines,
      footer: quote.cq_footer_text || '',
      taxes: [],
      // Default: hide all pricing when creating an order from a quote.
      // Most users don't send prices to suppliers. The editor has a
      // "Show all pricing" checkbox the user can tick to reveal them.
      hideLinePrices: true,
      hideTotals: true,
      showQuantityColumn: false,
    };
  } catch (error) {
    console.error('[quote-lbl-loader] Unexpected error:', error);
    return null;
  }
}
