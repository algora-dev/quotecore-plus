import { NextResponse } from 'next/server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

/**
 * GET /api/invoices/quote-search
 * Returns a list of the company's confirmed quotes for the "Create Invoice from Quote" picker.
 */
export async function GET() {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_name, job_name, status')
      .eq('company_id', profile.company_id)
      // Exclude drafts — a draft quote has no finalised lines yet and would
      // produce a blank invoice. Only confirmed/sent/accepted/etc. are ready.
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ quotes: [] }, { status: 500 });

    return NextResponse.json({ quotes: data ?? [] });
  } catch {
    return NextResponse.json({ quotes: [] }, { status: 401 });
  }
}
