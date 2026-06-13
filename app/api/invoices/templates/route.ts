import { NextResponse } from 'next/server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

/**
 * GET /api/invoices/templates
 * Returns the company's invoice templates for the creation modal picker.
 */
export async function GET() {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('name');

    return NextResponse.json({ templates: data ?? [] });
  } catch {
    return NextResponse.json({ templates: [] }, { status: 401 });
  }
}
