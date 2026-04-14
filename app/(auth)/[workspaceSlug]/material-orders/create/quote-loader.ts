'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export interface QuoteComponentData {
  id: string;
  line_name: string;
  quantity: number;
  unit: string;
  notes: string | null;
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
    
    // Load quote components (customer_quote_lines table)
    console.log('[QuoteLoader] Loading components for quote:', quoteId);
    const { data: components, error: componentsError } = await supabase
      .from('customer_quote_lines')
      .select('id, line_name, quantity, unit, notes')
      .eq('quote_id', quoteId)
      .order('line_order', { ascending: true });
    
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
    
    return {
      ...quote,
      components: components || [],
    };
  } catch (error) {
    console.error('[QuoteLoader] Unexpected error:', error);
    return null;
  }
}
