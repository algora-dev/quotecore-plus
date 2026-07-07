'use server';

import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

/**
 * Load calc_audit for all components in a quote.
 * Returns an array of { componentId, componentName, calcAudit } objects.
 * Only accessible to admin users.
 */
export async function loadCalcAuditsForQuote(quoteId: string): Promise<{
  ok: boolean;
  components?: Array<{
    componentId: string;
    componentName: string;
    measurementType: string;
    finalQuantity: number | null;
    materialCost: number | null;
    labourCost: number | null;
    calcAudit: unknown | null;
  }>;
  error?: string;
}> {
  const profile = await getCurrentProfile();
  if (!profile.is_admin) {
    return { ok: false, error: 'Admin access required' };
  }

  const supabase = await createSupabaseServerClient();
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .maybeSingle();

  if (!quote) return { ok: false, error: 'Quote not found' };

  const { data: components } = await supabase
    .from('quote_components')
    .select('id, name, measurement_type, final_quantity, material_cost, labour_cost, calc_audit')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });

  return {
    ok: true,
    components: (components ?? []).map((c) => ({
      componentId: c.id,
      componentName: c.name,
      measurementType: c.measurement_type,
      finalQuantity: c.final_quantity,
      materialCost: c.material_cost,
      labourCost: c.labour_cost,
      calcAudit: (c as { calc_audit?: unknown }).calc_audit ?? null,
    })),
  };
}
