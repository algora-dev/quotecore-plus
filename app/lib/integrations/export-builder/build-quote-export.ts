/**
 * Canonical Export Builder
 *
 * Reads quote domain data from Supabase and produces a QuoteExportV1 -
 * the stable, versioned export contract that all connectors consume.
 *
 * This is the ONLY place that translates database rows into the export shape.
 * Connectors never read database tables directly.
 */

import { createClient } from '@supabase/supabase-js';
import type {
  QuoteExportV1,
  CustomerLineExport,
  ComponentExport,
  ComponentEntryExport,
  RoofAreaExport,
  LabourLineExport,
  FileManifestItem,
  DocumentManifestItem,
  Address,
} from '../contracts/envelope-v1';

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function toAddress(fullAddress: string | null): Address | null {
  if (!fullAddress) return null;
  return {
    line1: null,
    line2: null,
    city: null,
    region: null,
    postalCode: null,
    country: null,
    fullAddress,
  };
}

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  return n.toFixed(4);
}

/**
 * Build the canonical export for a quote.
 * Returns null if the quote doesn't exist or the caller doesn't own it.
 */
export async function buildQuoteExport(
  quoteId: string,
  companyId: string
): Promise<QuoteExportV1 | null> {
  const supabase = createServiceClient();

  // Load quote header
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .single();

  if (qErr || !quote) return null;

  // Load customer lines
  const { data: customerLines } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  // Load components
  const { data: components } = await supabase
    .from('quote_components')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  // Load component entries
  const componentIds = (components ?? []).map((c) => c.id);
  const { data: componentEntries } = await supabase
    .from('quote_component_entries')
    .select('*')
    .in('quote_component_id', componentIds)
    .order('sort_order', { ascending: true });

  // Load roof areas
  const { data: roofAreas } = await supabase
    .from('quote_roof_areas')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  // Load roof area entries
  const roofAreaIds = (roofAreas ?? []).map((r) => r.id);
  const { data: roofAreaEntries } = await supabase
    .from('quote_roof_area_entries')
    .select('*')
    .in('quote_roof_area_id', roofAreaIds)
    .order('sort_order', { ascending: true });

  // Load labour sheet lines
  const { data: labourLines } = await supabase
    .from('labor_sheet_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  // Load tax settings
  const { data: taxSettings } = await supabase
    .from('company_taxes')
    .select('*')
    .eq('company_id', companyId);

  // Load files
  const { data: files } = await supabase
    .from('quote_files')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  // Build customer lines export
  const exportedCustomerLines: CustomerLineExport[] = (customerLines ?? []).map((l) => ({
    id: l.id,
    type: l.line_type ?? 'custom',
    description: l.custom_text ?? '',
    quantity: l.quantity ?? null,
    quantityText: l.quantity_text ?? null,
    unitPrice: l.unit_price != null ? money(l.unit_price) : (l.custom_amount != null ? money(l.custom_amount) : null),
    lineTotal: l.custom_amount != null ? money(l.custom_amount) : '0',
    visibleToCustomer: l.is_visible ?? true,
    includedInTotal: l.include_in_total ?? true,
    sortOrder: l.sort_order ?? 0,
  }));

  // Build component entries map
  const entriesByComponent = new Map<string, ComponentEntryExport[]>();
  for (const e of componentEntries ?? []) {
    const list = entriesByComponent.get(e.quote_component_id) ?? [];
    list.push({
      id: e.id,
      rawValue: e.raw_value?.toString() ?? null,
      pitchDegrees: e.pitch_degrees ?? null,
      wasteAdjustedValue: e.value_after_waste != null ? Number(e.value_after_waste).toFixed(4) : null,
      originalInputs: e.entry_inputs ?? null,
      combinedFrom: e.combined_from ?? null,
    });
    entriesByComponent.set(e.quote_component_id, list);
  }

  // Build components export
  const exportedComponents: ComponentExport[] = (components ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? '',
    mainOrExtra: null,
    measurementType: c.measurement_type ?? null,
    inputMode: c.input_mode ?? null,
    quantity: c.final_quantity != null ? Number(c.final_quantity) : null,
    pricedQuantity: c.priced_quantity != null ? Number(c.priced_quantity) : null,
    pricingUnit: c.pricing_unit ?? null,
    materialRate: c.material_rate != null ? money(c.material_rate) : null,
    labourRate: c.labour_rate != null ? money(c.labour_rate) : null,
    materialCost: c.material_cost != null ? money(c.material_cost) : null,
    labourCost: c.labour_cost != null ? money(c.labour_cost) : null,
    wastePercent: c.waste_percent != null ? c.waste_percent.toString() : null,
    pitchDegrees: c.calc_pitch_degrees ?? c.custom_pitch_degrees ?? null,
    pricingStrategy: null,
    packSize: c.pack_size_snapshot ?? null,
    customerVisible: c.is_customer_visible ?? true,
    sortOrder: c.sort_order ?? 0,
    libraryRef: c.component_library_id ?? null,
    sku: null,
    overrideFlags: null,
    entries: entriesByComponent.get(c.id) ?? [],
  }));

  // Build roof areas export with entries
  const entriesByRoofArea = new Map<string, typeof roofAreaEntries>();
  for (const e of roofAreaEntries ?? []) {
    const list = entriesByRoofArea.get(e.quote_roof_area_id) ?? [];
    list.push(e);
    entriesByRoofArea.set(e.quote_roof_area_id, list);
  }

  const exportedRoofAreas: RoofAreaExport[] = (roofAreas ?? []).map((r) => {
    const entries = entriesByRoofArea.get(r.id) ?? [];
    const totalPlanArea = entries.reduce((sum, e) => sum + (e.sqm ?? 0), 0);
    return {
      id: r.id,
      label: r.label ?? '',
      inputMode: r.input_mode ?? null,
      planWidth: entries[0]?.width_m ?? null,
      planLength: entries[0]?.length_m ?? null,
      planArea: totalPlanArea || (r.calc_plan_sqm ?? null),
      pitchDegrees: r.calc_pitch_degrees ?? null,
      computedArea: r.computed_sqm ?? null,
      finalArea: r.final_value_sqm ?? null,
    };
  });

  // Build labour lines export
  const exportedLabourLines: LabourLineExport[] | null = labourLines && labourLines.length > 0
    ? labourLines.map((l) => ({
        id: l.id,
        description: l.custom_text ?? '',
        amount: l.custom_amount != null ? money(l.custom_amount) : '0',
        componentRef: l.quote_component_id ?? null,
        visibleToCustomer: l.is_visible ?? true,
        includedInTotal: l.include_in_total ?? true,
        showPricing: l.show_price ?? true,
      }))
    : null;

  // Build file manifest
  const exportedFiles: FileManifestItem[] = (files ?? []).map((f) => ({
    id: f.id,
    fileType: f.file_type ?? 'supporting',
    fileName: f.file_name ?? 'unnamed',
    mimeType: f.mime_type ?? null,
    sizeBytes: f.file_size ?? null,
    checksum: null,
    sourcePath: f.storage_path ?? '',
  }));

  // Build documents manifest (quote PDFs, etc.)
  const exportedDocuments: DocumentManifestItem[] = [];
  if (quote.takeoff_canvas_path) {
    exportedDocuments.push({
      id: `canvas-${quote.id}`,
      documentType: 'summary',
      fileName: 'takeoff-canvas.png',
      mimeType: 'image/png',
      sourcePath: quote.takeoff_canvas_path,
    });
  }

  // Compute totals from customer lines
  const visibleLines = exportedCustomerLines.filter((l) => l.includedInTotal);
  const subtotal = visibleLines.reduce((sum, l) => sum + parseFloat(l.lineTotal), 0);
  const taxRate = quote.tax_rate ?? 0;
  const taxTotal = subtotal * (taxRate / 100);
  const totalIncludingTax = subtotal + taxTotal;

  // Determine tax mode
  const taxMode: 'inclusive' | 'exclusive' | 'unknown' =
    taxRate > 0 ? 'exclusive' : 'unknown';

  // Build totals
  const materialCost = exportedComponents.reduce(
    (sum, c) => sum + (c.materialCost ? parseFloat(c.materialCost) : 0),
    0
  );
  const labourCost = exportedComponents.reduce(
    (sum, c) => sum + (c.labourCost ? parseFloat(c.labourCost) : 0),
    0
  );

  // Build the export
  const exportData: QuoteExportV1 = {
    source: {
      application: 'quote-core-plus',
      quoteId: quote.id,
      quoteNumber: quote.quote_number ?? null,
      quoteUrl: quote.quote_number
        ? `https://app.quote-core.com/q/${quote.id}`
        : null,
    },
    customer: {
      name: quote.customer_name ?? '',
      email: quote.customer_email ?? null,
      phone: quote.customer_phone ?? null,
      billingAddress: toAddress(quote.site_address ?? null),
    },
    site: {
      name: quote.job_name ?? null,
      address: toAddress(quote.site_address ?? null),
      latitude: null,
      longitude: null,
      accessNotes: null,
    },
    job: {
      name: quote.job_name ?? null,
      trade: quote.trade ?? 'roofing',
      status: quote.job_status ?? quote.status ?? 'draft',
      measurementSystem: quote.measurement_system ?? 'metric',
    },
    quote: {
      currency: quote.currency ?? 'NZD',
      createdAt: quote.created_at ?? new Date().toISOString(),
      updatedAt: quote.updated_at ?? new Date().toISOString(),
      acceptedAt: quote.accepted_at ?? null,
      validUntil: null,
      customerFacingNotes: null,
      internalNotes: quote.notes_internal ?? null,
      assumptions: null,
    },
    company: {
      name: quote.cq_company_name ?? null,
      address: quote.cq_company_address ?? null,
      phone: quote.cq_company_phone ?? null,
      email: quote.cq_company_email ?? null,
      logoUrl: quote.cq_company_logo_url ?? null,
      footerText: quote.cq_footer_text ?? null,
    },
    customerLines: exportedCustomerLines,
    components: exportedComponents,
    roofAreas: exportedRoofAreas,
    labourLines: exportedLabourLines,
    totals: {
      currency: quote.currency ?? 'NZD',
      taxMode,
      customerTotals: {
        subtotalExcludingTax: money(subtotal),
        discountTotal: '0.0000',
        taxTotal: money(taxTotal),
        totalIncludingTax: money(totalIncludingTax),
        roundingAdjustment: '0.0000',
      },
      costTotals: {
        materialCost: money(materialCost),
        labourCost: money(labourCost),
        totalCost: money(materialCost + labourCost),
      },
      marginTotals: {
        materialMargin: money(subtotal - materialCost - labourCost),
        labourMargin: '0.0000',
        grossProfit: money(subtotal - materialCost - labourCost),
      },
      taxBreakdown: taxSettings
        ? taxSettings.map((t) => ({
            name: t.tax_name ?? 'Tax',
            ratePercent: (t.tax_rate ?? 0).toString(),
            amount: money(subtotal * ((t.tax_rate ?? 0) / 100)),
            externalTaxCode: t.external_tax_code ?? null,
          }))
        : [],
    },
    files: exportedFiles,
    documents: exportedDocuments,
    acceptance: {
      status: quote.status ?? 'draft',
      acceptedAt: quote.accepted_at ?? null,
      acceptedBy: null,
    },
  };

  return exportData;
}

/**
 * Compute the current revision of a quote for idempotency.
 * Uses updated_at timestamp as a proxy for revision - changes whenever
 * any quote data changes. In future, add an explicit revision column.
 */
export async function getQuoteRevision(
  quoteId: string,
  companyId: string
): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('quotes')
    .select('updated_at')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .single();

  if (!data) return 0;
  // Convert ISO timestamp to a numeric hash for revision
  return Math.floor(new Date(data.updated_at).getTime() / 1000);
}
