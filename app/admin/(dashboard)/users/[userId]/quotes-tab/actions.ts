'use server';

/**
 * Admin Quote Storyline Viewer — server actions.
 * =================================================
 * Search a user's quotes and load full calc audit storyline data.
 * Gated behind requireAdmin(). Uses service-role client.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// ─── Types ──────────────────────────────────────────

export interface QuoteSearchRow {
  id: string;
  quote_number: number | null;
  customer_name: string;
  job_name: string | null;
  job_status: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  component_count: number;
  total_material: number;
  total_labour: number;
  currency: string | null;
}

export interface StorylineComponent {
  componentId: string;
  componentName: string;
  measurementType: string;
  sortOrder: number;
  finalQuantity: number | null;
  materialCost: number | null;
  labourCost: number | null;
  calcAudit: unknown | null;
  // Joined area info
  areaName: string | null;
  areaPitchDegrees: number | null;
  // Entries
  entries: Array<{
    id: string;
    rawValue: number | null;
    valueAfterWaste: number | null;
    pitchDegrees: number | null;
    sortOrder: number;
    entryInputs: unknown | null;
    pageId: string | null;
  }>;
}

export interface StorylineData {
  quote: {
    id: string;
    quoteNumber: number | null;
    customerName: string;
    jobName: string | null;
    jobStatus: string | null;
    status: string;
    currency: string | null;
    createdAt: string;
    updatedAt: string;
  };
  components: StorylineComponent[];
}

// ─── searchUserQuotes ───────────────────────────────

export async function searchUserQuotes(
  companyId: string,
  opts?: { query?: string; status?: string },
): Promise<{ ok: true; rows: QuoteSearchRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  let q = admin
    .from('quotes')
    .select(`
      id, quote_number, customer_name, job_name, job_status, status,
      created_at, updated_at, currency
    `)
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (opts?.query?.trim()) {
    const term = opts.query.trim();
    q = q.or(`customer_name.ilike.%${term}%,job_name.ilike.%${term}%`);
  }

  if (opts?.status && opts.status !== 'all') {
    q = q.eq('status', opts.status as 'draft' | 'confirmed' | 'sent' | 'accepted' | 'declined' | 'expired' | 'archived');
  }

  const { data: quotes, error } = await q;
  if (error) return { ok: false, error: error.message };
  if (!quotes || quotes.length === 0) return { ok: true, rows: [] };

  // Batch-fetch component counts + cost totals for all quotes
  const quoteIds = quotes.map((qq) => qq.id);
  const { data: compStats, error: compErr } = await admin
    .from('quote_components')
    .select('quote_id, material_cost, labour_cost')
    .in('quote_id', quoteIds);

  if (compErr) {
    // Non-fatal — return quotes with zeroed totals
    console.error('[admin/searchUserQuotes] component stats error:', compErr.message);
  }

  // Aggregate per quote
  const statsMap = new Map<string, { count: number; material: number; labour: number }>();
  for (const c of compStats ?? []) {
    const existing = statsMap.get(c.quote_id) ?? { count: 0, material: 0, labour: 0 };
    existing.count += 1;
    existing.material += Number(c.material_cost ?? 0);
    existing.labour += Number(c.labour_cost ?? 0);
    statsMap.set(c.quote_id, existing);
  }

  const rows: QuoteSearchRow[] = quotes.map((qq) => {
    const stats = statsMap.get(qq.id);
    return {
      id: qq.id,
      quote_number: qq.quote_number,
      customer_name: qq.customer_name,
      job_name: qq.job_name,
      job_status: qq.job_status,
      status: qq.status,
      created_at: qq.created_at,
      updated_at: qq.updated_at,
      currency: qq.currency,
      component_count: stats?.count ?? 0,
      total_material: stats?.material ?? 0,
      total_labour: stats?.labour ?? 0,
    };
  });

  return { ok: true, rows };
}

// ─── loadQuoteStoryline ─────────────────────────────

export async function loadQuoteStoryline(
  quoteId: string,
): Promise<{ ok: true; data: StorylineData } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  // 1. Load quote header
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select(`
      id, quote_number, customer_name, job_name, job_status, status,
      currency, created_at, updated_at
    `)
    .eq('id', quoteId)
    .maybeSingle();

  if (qErr || !quote) return { ok: false, error: 'Quote not found' };

  // 2. Load components with calc_audit + roof area join
  const { data: components, error: cErr } = await admin
    .from('quote_components')
    .select(`
      id, name, measurement_type, sort_order,
      final_quantity, material_cost, labour_cost, calc_audit,
      quote_roof_area_id
    `)
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  if (cErr) return { ok: false, error: cErr.message };

  // 3. Load roof areas for name + pitch lookup
  const areaIds = (components ?? [])
    .map((c) => c.quote_roof_area_id)
    .filter((id): id is string => !!id);

  const areaMap = new Map<string, { name: string; pitch: number | null }>();
  if (areaIds.length > 0) {
    const { data: areas } = await admin
      .from('quote_roof_areas')
      .select('id, label, calc_pitch_degrees')
      .in('id', areaIds);
    for (const a of areas ?? []) {
      areaMap.set(a.id, { name: a.label, pitch: a.calc_pitch_degrees });
    }
  }

  // 4. Load entries for each component
  const componentIds = (components ?? []).map((c) => c.id);
  const entriesMap = new Map<string, StorylineComponent['entries']>();

  if (componentIds.length > 0) {
    const { data: entries } = await admin
      .from('quote_component_entries')
      .select('id, quote_component_id, raw_value, value_after_waste, pitch_degrees, sort_order, entry_inputs, page_id')
      .in('quote_component_id', componentIds)
      .order('sort_order', { ascending: true });

    for (const e of entries ?? []) {
      const list = entriesMap.get(e.quote_component_id) ?? [];
      list.push({
        id: e.id,
        rawValue: e.raw_value,
        valueAfterWaste: e.value_after_waste,
        pitchDegrees: e.pitch_degrees,
        sortOrder: e.sort_order,
        entryInputs: e.entry_inputs,
        pageId: e.page_id,
      });
      entriesMap.set(e.quote_component_id, list);
    }
  }

  // 5. Assemble
  const storylineComponents: StorylineComponent[] = (components ?? []).map((c) => {
    const area = c.quote_roof_area_id ? areaMap.get(c.quote_roof_area_id) : null;
    return {
      componentId: c.id,
      componentName: c.name,
      measurementType: c.measurement_type,
      sortOrder: c.sort_order,
      finalQuantity: c.final_quantity,
      materialCost: c.material_cost,
      labourCost: c.labour_cost,
      calcAudit: (c as { calc_audit?: unknown }).calc_audit ?? null,
      areaName: area?.name ?? null,
      areaPitchDegrees: area?.pitch ?? null,
      entries: entriesMap.get(c.id) ?? [],
    };
  });

  return {
    ok: true,
    data: {
      quote: {
        id: quote.id,
        quoteNumber: quote.quote_number,
        customerName: quote.customer_name,
        jobName: quote.job_name,
        jobStatus: quote.job_status,
        status: quote.status,
        currency: quote.currency,
        createdAt: quote.created_at,
        updatedAt: quote.updated_at,
      },
      components: storylineComponents,
    },
  };
}
