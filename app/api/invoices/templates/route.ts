import { NextResponse } from 'next/server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

/** P7-API-01. Empty is a successful query with zero rows, not a provider error. */
export async function GET() {
  let profile: Awaited<ReturnType<typeof requireCompanyContext>>;
  try {
    profile = await requireCompanyContext();
  } catch {
    return NextResponse.json({ error: 'Sign in to load invoice templates.' }, { status: 401 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('name');
    if (error) throw error;
    return NextResponse.json({ templates: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[invoice-templates] List unavailable:', error);
    return NextResponse.json(
      { error: 'Invoice templates could not be loaded. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
