'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { verifyQuoteOwnership } from '@/app/lib/auth/ownership';
import type { CompanyTaxRow, QuoteTaxRow } from './types';

// ---------------------------------------------------------------------------
// Company defaults
// ---------------------------------------------------------------------------

export async function loadCompanyTaxes(): Promise<CompanyTaxRow[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('company_taxes')
    .select('*')
    .eq('company_id', profile.company_id)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyTaxRow[];
}

interface CompanyTaxInput {
  id?: string; // when present, treated as update
  name: string;
  rate_percent: number;
  sort_order: number;
}

/**
 * Replace the company's full tax list in one shot.
 *
 * The settings UI lets the user add, edit, reorder, and remove taxes inline,
 * then hits "Save". This action treats the supplied list as the new ground truth:
 *
 *  - Existing rows whose id is in `taxes` get updated.
 *  - Rows in `taxes` without an id get inserted.
 *  - Any existing rows whose id is NOT in `taxes` get archived (soft-deleted) so
 *    historical references survive but they stop appearing in the picker.
 */
export async function saveCompanyTaxes(taxes: CompanyTaxInput[]): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Validate up front so we never write a partial state.
  for (const t of taxes) {
    const trimmed = (t.name ?? '').trim();
    if (!trimmed) throw new Error('Each tax must have a name');
    const r = Number(t.rate_percent);
    if (!Number.isFinite(r) || r < 0 || r > 100) {
      throw new Error(`Invalid rate for "${trimmed}": must be between 0 and 100`);
    }
  }

  const { data: existing, error: loadErr } = await supabase
    .from('company_taxes')
    .select('id')
    .eq('company_id', profile.company_id)
    .is('archived_at', null);
  if (loadErr) throw new Error(loadErr.message);

  const incomingIds = new Set(taxes.map((t) => t.id).filter(Boolean) as string[]);
  const toArchive = (existing ?? []).filter((row) => !incomingIds.has(row.id));

  // Archive rows the user removed.
  if (toArchive.length > 0) {
    const { error: archErr } = await supabase
      .from('company_taxes')
      .update({ archived_at: new Date().toISOString() })
      .in('id', toArchive.map((r) => r.id));
    if (archErr) throw new Error(archErr.message);
  }

  // Upsert each remaining row (insert when id is missing, update when present).
  for (const t of taxes) {
    const payload = {
      company_id: profile.company_id,
      name: t.name.trim(),
      rate_percent: Number(t.rate_percent),
      sort_order: t.sort_order,
    };
    if (t.id) {
      const { error } = await supabase
        .from('company_taxes')
        .update(payload)
        .eq('id', t.id)
        .eq('company_id', profile.company_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('company_taxes').insert(payload);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath('/');
}

// ---------------------------------------------------------------------------
// Per-quote taxes
// ---------------------------------------------------------------------------

export async function loadQuoteTaxes(quoteId: string): Promise<QuoteTaxRow[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);
  const { data, error } = await supabase
    .from('quote_taxes')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuoteTaxRow[];
}

interface QuoteTaxInput {
  id?: string;
  source_tax_id?: string | null;
  name: string;
  rate_percent: number;
  sort_order: number;
  include_in_quote: boolean;
  include_in_labor: boolean;
}

/**
 * Replace the per-quote tax list. Mirrors saveCompanyTaxes semantics so the editor
 * UX is identical between the company defaults and the per-quote override.
 */
export async function saveQuoteTaxes(quoteId: string, taxes: QuoteTaxInput[]): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);

  for (const t of taxes) {
    const trimmed = (t.name ?? '').trim();
    if (!trimmed) throw new Error('Each tax must have a name');
    const r = Number(t.rate_percent);
    if (!Number.isFinite(r) || r < 0 || r > 100) {
      throw new Error(`Invalid rate for "${trimmed}": must be between 0 and 100`);
    }
  }

  const { data: existing, error: loadErr } = await supabase
    .from('quote_taxes')
    .select('id')
    .eq('quote_id', quoteId);
  if (loadErr) throw new Error(loadErr.message);

  const incomingIds = new Set(taxes.map((t) => t.id).filter(Boolean) as string[]);
  const toDelete = (existing ?? []).filter((row) => !incomingIds.has(row.id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('quote_taxes')
      .delete()
      .in('id', toDelete.map((r) => r.id));
    if (error) throw new Error(error.message);
  }

  for (const t of taxes) {
    const payload = {
      quote_id: quoteId,
      source_tax_id: t.source_tax_id ?? null,
      name: t.name.trim(),
      rate_percent: Number(t.rate_percent),
      sort_order: t.sort_order,
      include_in_quote: !!t.include_in_quote,
      include_in_labor: !!t.include_in_labor,
    };
    if (t.id) {
      const { error } = await supabase
        .from('quote_taxes')
        .update(payload)
        .eq('id', t.id)
        .eq('quote_id', quoteId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('quote_taxes').insert(payload);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath('/');
}

/**
 * Snapshot the current company defaults onto a quote. Used at quote creation,
 * and exposed as a manual "Reset to company defaults" affordance in the editor.
 */
export async function seedQuoteTaxesFromCompanyDefaults(quoteId: string): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);

  const { data: defaults, error: loadErr } = await supabase
    .from('company_taxes')
    .select('id, name, rate_percent, sort_order')
    .eq('company_id', profile.company_id)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (loadErr) throw new Error(loadErr.message);

  // Wipe any existing rows so this acts like a true reset.
  const { error: delErr } = await supabase.from('quote_taxes').delete().eq('quote_id', quoteId);
  if (delErr) throw new Error(delErr.message);

  if (!defaults || defaults.length === 0) return;

  const rows = defaults.map((d) => ({
    quote_id: quoteId,
    source_tax_id: d.id,
    name: d.name,
    rate_percent: d.rate_percent,
    sort_order: d.sort_order,
    include_in_quote: true,
    include_in_labor: true,
  }));
  const { error: insErr } = await supabase.from('quote_taxes').insert(rows);
  if (insErr) throw new Error(insErr.message);

  revalidatePath('/');
}
