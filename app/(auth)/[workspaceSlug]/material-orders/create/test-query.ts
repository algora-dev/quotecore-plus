'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function testQuoteQuery(quoteId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  console.log('[TEST] Company ID:', profile.company_id);
  console.log('[TEST] Quote ID:', quoteId);
  
  // Test 1: Check if quote exists
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();
  
  console.log('[TEST] Quote query:', { quote, error: quoteError });
  
  // Test 2: Get ALL customer_quote_lines (no filter)
  const { data: allLines, error: allError } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .limit(5);
  
  console.log('[TEST] Sample lines (no filter):', { allLines, error: allError });
  
  // Test 3: Filter by quote_id
  const { data: quoteLines, error: quoteLinesError } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quoteId);
  
  console.log('[TEST] Lines for this quote:', { quoteLines, error: quoteLinesError });
  
  return {
    quote,
    allLines,
    quoteLines,
    errors: {
      quoteError,
      allError,
      quoteLinesError
    }
  };
}
