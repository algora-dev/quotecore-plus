'use server';

/**
 * Bulk operations on quotes (multi-select on the quotes list page).
 *
 * - loadQuoteBundleData(quoteId): returns everything needed to build a single
 *   downloadable archive for one quote (summary, customer quote, labour sheet,
 *   files with signed URLs, metadata). Used by the client-side ZIP builder.
 * - bulkDeleteQuotes(ids[]): deletes multiple quotes (and their storage files)
 *   in one server round-trip. Each quote is verified against the caller's
 *   company_id before any destructive action.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { computeQuoteTotals } from '@/app/lib/pricing/engine';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';

const QUOTE_DOCUMENTS_BUCKET = 'QUOTE-DOCUMENTS';
const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 minutes — plenty for a download cycle

export interface QuoteBundleFile {
  id: string;
  fileType: 'plan' | 'supporting' | 'canvas';
  fileName: string;
  storagePath: string | null;
  /** Signed/public URL that the browser can fetch. */
  url: string;
}

export interface QuoteBundleLine {
  text: string;
  amount: number;
  showPrice: boolean;
  showUnits: boolean;
  isVisible: boolean;
  includeInTotal: boolean;
}

export interface QuoteBundleComponent {
  id: string;
  name: string;
  componentType: string | null;
  measurementType: string | null;
  finalQuantity: number;
  pricingUnit: string | null;
  materialCost: number;
  labourCost: number;
  isCustomerVisible: boolean;
  roofAreaLabel: string | null;
}

export interface QuoteBundleData {
  quote: {
    id: string;
    quoteNumber: number | null;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    jobName: string | null;
    siteAddress: string | null;
    status: string;
    jobStatus: string | null;
    measurementSystem: string | null;
    currency: string;
    taxRate: number;
    materialMarginPercent: number | null;
    laborMarginPercent: number | null;
    createdAt: string;
    updatedAt: string;
    notes: string | null;
    /** Branding snapshot for the customer quote. */
    branding: {
      companyName: string | null;
      companyAddress: string | null;
      companyPhone: string | null;
      companyEmail: string | null;
      companyLogoUrl: string | null;
      footerText: string | null;
    };
  };
  roofAreas: Array<{
    id: string;
    label: string;
    computedSqm: number;
  }>;
  components: QuoteBundleComponent[];
  /** Customer-facing quote lines (the simplified view sent to the customer). */
  customerLines: QuoteBundleLine[];
  /** Internal labour sheet lines (only present when the user has built one). */
  labourLines: QuoteBundleLine[];
  totals: {
    materialSubtotal: number;
    labourSubtotal: number;
    subtotalWithMargins: number;
    customLinesTotal: number;
    adjustedSubtotal: number;
    taxTotal: number;
    grandTotal: number;
    taxLines: Array<{ name: string; amount: number; ratePercent: number }>;
  };
  files: QuoteBundleFile[];
}

/**
 * Load everything needed to build one quote's downloadable archive.
 * Returns null if the quote doesn't exist or doesn't belong to the caller's company.
 */
export async function loadQuoteBundleData(quoteId: string): Promise<QuoteBundleData | null> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .single();

  if (!quote) return null;

  // Pull related data in parallel where possible.
  const [
    roofAreasRes,
    componentsRes,
    customerLinesRes,
    labourLinesRes,
    quoteTaxesRes,
    filesRes,
    companyRes,
  ] = await Promise.all([
    supabase.from('quote_roof_areas').select('id, label, computed_sqm').eq('quote_id', quoteId).order('sort_order'),
    supabase.from('quote_components').select('*').eq('quote_id', quoteId).order('sort_order'),
    supabase.from('customer_quote_lines').select('*').eq('quote_id', quoteId).order('sort_order'),
    supabase.from('labor_sheet_lines').select('*').eq('quote_id', quoteId).order('sort_order'),
    supabase.from('quote_taxes').select('*').eq('quote_id', quoteId).order('sort_order'),
    supabase
      .from('quote_files')
      .select('id, file_type, file_name, storage_path, uploaded_at')
      .eq('quote_id', quoteId)
      .order('uploaded_at', { ascending: false }),
    supabase.from('companies').select('default_currency').eq('id', profile.company_id).single(),
  ]);

  const roofAreas = roofAreasRes.data ?? [];
  const components = componentsRes.data ?? [];
  const customerLines = customerLinesRes.data ?? [];
  const labourLines = labourLinesRes.data ?? [];
  const quoteTaxes = quoteTaxesRes.data ?? [];
  const dbFiles = filesRes.data ?? [];
  const companyDefaultCurrency: string = companyRes.data?.default_currency ?? 'USD';

  // Resolve roof area label per component for the JSON export.
  const areaLabelById = new Map<string, string>();
  for (const a of roofAreas) areaLabelById.set(a.id, a.label);

  // Compute totals using the same engine the summary page uses, so the export
  // stays in sync with what the user sees on screen.
  const engineComps = components.map((c: any) => ({
    id: c.id,
    name: c.name,
    componentType: c.component_type as 'main' | 'extra',
    measurementType: c.measurement_type,
    inputMode: c.input_mode,
    finalValue: c.final_value ?? undefined,
    calcRawValue: c.calc_raw_value ?? undefined,
    calcPitchDegrees: c.calc_pitch_degrees ?? undefined,
    calcPitchFactor: c.calc_pitch_factor ?? undefined,
    wasteType: c.waste_type,
    wastePercent: c.waste_percent,
    wasteFixed: c.waste_fixed,
    finalQuantity: c.final_quantity ?? undefined,
    materialRate: c.material_rate,
    labourRate: c.labour_rate,
    materialCost: c.material_cost,
    labourCost: c.labour_cost,
    isRateOverridden: c.is_rate_overridden,
    isQuantityOverridden: c.is_quantity_overridden,
    isWasteOverridden: c.is_waste_overridden,
    isPitchOverridden: c.is_pitch_overridden,
    isCustomerVisible: c.is_customer_visible,
    pricingUnit: c.pricing_unit ?? undefined,
  }));

  const totals = computeQuoteTotals(engineComps as any, {
    materialMarginPct: quote.material_margin_percent ?? 0,
    labourMarginPct: quote.labor_margin_percent ?? 0,
    taxRate: quote.tax_rate,
  });

  const customLinesTotal = customerLines.reduce(
    (sum: number, line: any) => sum + (Number(line.custom_amount) || 0),
    0
  );
  const adjustedSubtotal = totals.subtotalWithMargins + customLinesTotal;
  const { lines: taxLineItems, total: taxTotal } = computeTaxLines(quoteTaxes as any, adjustedSubtotal, 'quote');
  const grandTotal = adjustedSubtotal + taxTotal;

  // Build signed URLs for storage files. The bucket is private (`QUOTE-DOCUMENTS`),
  // so we must mint signed URLs server-side rather than trying public URLs.
  const supabaseAdmin = createAdminClient();
  const filesWithUrls: QuoteBundleFile[] = [];
  for (const f of dbFiles) {
    if (!f.storage_path) continue;
    const { data: signed, error: signErr } = await supabaseAdmin
      .storage
      .from(QUOTE_DOCUMENTS_BUCKET)
      .createSignedUrl(f.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      console.warn('[loadQuoteBundleData] signed URL failed for', f.storage_path, signErr?.message);
      continue;
    }
    filesWithUrls.push({
      id: f.id,
      fileType: f.file_type === 'plan' ? 'plan' : 'supporting',
      fileName: f.file_name,
      storagePath: f.storage_path,
      url: signed.signedUrl,
    });
  }

  // Add takeoff canvas snapshots (already public on the quote row).
  if (quote.takeoff_canvas_url) {
    filesWithUrls.push({
      id: 'canvas-image',
      fileType: 'canvas',
      fileName: 'Digital-Takeoff-Canvas.png',
      storagePath: null,
      url: quote.takeoff_canvas_url,
    });
  }
  if (quote.takeoff_lines_url) {
    filesWithUrls.push({
      id: 'canvas-lines',
      fileType: 'canvas',
      fileName: 'Takeoff-Lines-Only.png',
      storagePath: null,
      url: quote.takeoff_lines_url,
    });
  }

  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

  return {
    quote: {
      id: quote.id,
      quoteNumber: quote.quote_number,
      customerName: quote.customer_name,
      customerEmail: quote.customer_email ?? null,
      customerPhone: quote.customer_phone ?? null,
      jobName: quote.job_name ?? null,
      siteAddress: quote.site_address ?? null,
      status: quote.status,
      jobStatus: quote.job_status ?? null,
      measurementSystem: quote.measurement_system ?? null,
      currency: effectiveCurrency,
      taxRate: Number(quote.tax_rate) || 0,
      materialMarginPercent: quote.material_margin_percent,
      laborMarginPercent: quote.labor_margin_percent,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      notes: (quote as any).notes ?? null,
      branding: {
        companyName: quote.cq_company_name,
        companyAddress: quote.cq_company_address,
        companyPhone: quote.cq_company_phone,
        companyEmail: quote.cq_company_email,
        companyLogoUrl: quote.cq_company_logo_url,
        footerText: quote.cq_footer_text,
      },
    },
    roofAreas: roofAreas.map((a: any) => ({
      id: a.id,
      label: a.label,
      computedSqm: Number(a.computed_sqm) || 0,
    })),
    components: components.map((c: any) => ({
      id: c.id,
      name: c.name,
      componentType: c.component_type,
      measurementType: c.measurement_type,
      finalQuantity: Number(c.final_quantity) || 0,
      pricingUnit: c.pricing_unit ?? null,
      materialCost: Number(c.material_cost) || 0,
      labourCost: Number(c.labour_cost) || 0,
      isCustomerVisible: c.is_customer_visible !== false,
      roofAreaLabel: c.quote_roof_area_id ? areaLabelById.get(c.quote_roof_area_id) ?? null : null,
    })),
    customerLines: customerLines.map((l: any) => ({
      text: l.custom_text ?? '',
      amount: Number(l.custom_amount) || 0,
      showPrice: !!l.show_price,
      showUnits: !!l.show_units,
      isVisible: l.is_visible !== false,
      includeInTotal: l.include_in_total !== false,
    })),
    labourLines: labourLines.map((l: any) => ({
      text: l.custom_text ?? '',
      amount: Number(l.custom_amount) || 0,
      showPrice: !!l.show_price,
      showUnits: !!l.show_units,
      isVisible: l.is_visible !== false,
      includeInTotal: l.include_in_total !== false,
    })),
    totals: {
      materialSubtotal: totals.totalMaterials,
      labourSubtotal: totals.totalLabour,
      subtotalWithMargins: totals.subtotalWithMargins,
      customLinesTotal,
      adjustedSubtotal,
      taxTotal,
      grandTotal,
      taxLines: taxLineItems.map((t: any) => ({
        name: t.name,
        amount: t.amount,
        ratePercent: t.rate_percent,
      })),
    },
    files: filesWithUrls,
  };
}

/**
 * Delete multiple quotes in one call. Each id is verified against the caller's
 * company_id before any destructive action; unknown / cross-company ids are
 * silently skipped (we still report a count back so the UI knows what happened).
 *
 * For each quote we:
 *   1. Look up storage paths from quote_files
 *   2. Remove storage objects (best-effort — we still proceed if storage is gone)
 *   3. Delete the quote row (cascades clean up children)
 */
export async function bulkDeleteQuotes(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const profile = await requireCompanyContext();
  if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0, skipped: 0 };

  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createAdminClient();

  // Filter to quotes actually owned by this company.
  const { data: ownedQuotes } = await supabase
    .from('quotes')
    .select('id')
    .in('id', ids)
    .eq('company_id', profile.company_id);

  const ownedIds = (ownedQuotes ?? []).map((q: any) => q.id as string);
  const skipped = ids.length - ownedIds.length;
  if (ownedIds.length === 0) return { deleted: 0, skipped };

  // Pull all storage paths for the owned quotes in one query.
  const { data: filesToDelete } = await supabaseAdmin
    .from('quote_files')
    .select('storage_path')
    .in('quote_id', ownedIds);

  const storagePaths = (filesToDelete ?? [])
    .map((f: any) => f.storage_path)
    .filter((p: string | null): p is string => !!p);

  if (storagePaths.length > 0) {
    // Storage `remove` accepts up to 1000 paths per call; chunk to be safe.
    const chunkSize = 500;
    for (let i = 0; i < storagePaths.length; i += chunkSize) {
      const chunk = storagePaths.slice(i, i + chunkSize);
      const { error: storageErr } = await supabaseAdmin.storage
        .from(QUOTE_DOCUMENTS_BUCKET)
        .remove(chunk);
      if (storageErr) {
        console.warn('[bulkDeleteQuotes] storage remove warning:', storageErr.message);
      }
    }
  }

  // Delete the quote rows (cascade handles children).
  const { error: deleteErr } = await supabase
    .from('quotes')
    .delete()
    .in('id', ownedIds)
    .eq('company_id', profile.company_id);

  if (deleteErr) {
    throw new Error(`Failed to delete quotes: ${deleteErr.message}`);
  }

  revalidatePath('/');

  return { deleted: ownedIds.length, skipped };
}
