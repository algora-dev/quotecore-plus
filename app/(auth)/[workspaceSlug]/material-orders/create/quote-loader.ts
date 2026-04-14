'use server';

// Quote data loader - uses customer_quote_lines table (2026-04-14)

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export interface QuoteComponentData {
  id: string;
  name: string;
  component_library_id: string | null;
  quantity: number;
  unit: string;
  measurements: any; // JSONB - contains entries/individual measurements
  notes: string | null;
  component_library?: {
    flashing_ids: string[] | null;
  } | null;
}

export interface QuoteData {
  id: string;
  quote_number: string;
  job_name: string | null;
  customer_name: string | null;
  components: QuoteComponentData[];
}

export async function loadQuoteData(quoteId: string): Promise<QuoteData | null> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();
    
    // Load quote header
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, quote_number, job_name, customer_name')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();
    
    if (quoteError || !quote) {
      console.error('[QuoteLoader] Quote not found:', quoteError);
      return null;
    }
    
    // Load quote components with component_library join for flashing_id
    console.log('[QuoteLoader] Loading quote_components for quote:', quoteId);
    const { data: components, error: componentsError } = await supabase
      .from('quote_components')
      .select(`
        id,
        name,
        component_library_id,
        quantity,
        unit,
        measurements,
        notes,
        display_order,
        component_library:component_library_id(flashing_ids)
      `)
      .eq('quote_id', quoteId)
      .order('display_order', { ascending: true });
    
    console.log('[QuoteLoader] Components query result:', { components, error: componentsError });
    
    if (componentsError) {
      console.error('[QuoteLoader] Components load error:', componentsError);
      console.error('[QuoteLoader] Error details:', JSON.stringify(componentsError));
      return {
        ...quote,
        components: [],
      };
    }
    
    console.log('[QuoteLoader] Loaded', components?.length || 0, 'components');
    
    // Normalize component_library join (returns array, we want single object)
    const normalizedComponents = components?.map((comp: any) => ({
      id: comp.id,
      name: comp.name,
      component_library_id: comp.component_library_id,
      quantity: comp.quantity,
      unit: comp.unit,
      measurements: comp.measurements,
      notes: comp.notes,
      component_library: Array.isArray(comp.component_library) && comp.component_library.length > 0
        ? comp.component_library[0]
        : comp.component_library,
    })) || [];
    
    return {
      ...quote,
      components: normalizedComponents,
    };
  } catch (error) {
    console.error('[QuoteLoader] Unexpected error:', error);
    return null;
  }
}
