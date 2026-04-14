'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export interface QuoteComponentData {
  id: string;
  name: string;
  flashing_id: string | null;
  quantity: number;
  unit: string;
  measurements: any; // JSONB
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
    
    // Load quote components
    const { data: components, error: componentsError } = await supabase
      .from('quote_components')
      .select('id, name, flashing_id, quantity, unit, measurements, notes')
      .eq('quote_id', quoteId)
      .order('display_order', { ascending: true });
    
    if (componentsError) {
      console.error('[QuoteLoader] Components load error:', componentsError);
      return {
        ...quote,
        components: [],
      };
    }
    
    return {
      ...quote,
      components: components || [],
    };
  } catch (error) {
    console.error('[QuoteLoader] Unexpected error:', error);
    return null;
  }
}
