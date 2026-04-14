'use server';

// Quote data loader - uses customer_quote_lines table (2026-04-14)

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export interface QuoteComponentData {
  id: string;
  custom_text: string;
  custom_amount: number;
  line_type: string;
  quote_component_id: string | null;
  component?: {
    flashing_id: string | null;
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
    
    // Load quote components with flashing data via quote_components join
    console.log('[QuoteLoader] Loading components for quote:', quoteId);
    const { data: components, error: componentsError } = await supabase
      .from('customer_quote_lines')
      .select(`
        id,
        custom_text,
        custom_amount,
        line_type,
        quote_component_id,
        component:quote_components!quote_component_id(flashing_id)
      `)
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });
    
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
    
    // Normalize component data (join returns array, we want single object)
    const normalizedComponents = components?.map((comp: any) => ({
      id: comp.id,
      custom_text: comp.custom_text,
      custom_amount: comp.custom_amount,
      line_type: comp.line_type,
      quote_component_id: comp.quote_component_id,
      component: Array.isArray(comp.component) && comp.component.length > 0 
        ? comp.component[0] 
        : comp.component,
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
