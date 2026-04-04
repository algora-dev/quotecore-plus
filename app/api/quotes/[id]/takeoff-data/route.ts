import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params;
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Load quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('company_id', profile.company_id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Load roof plan
    const { data: planFile } = await supabase
      .from('quote_files')
      .select('file_path')
      .eq('quote_id', quoteId)
      .eq('file_type', 'roof_plan')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    if (!planFile) {
      return NextResponse.json({ error: 'No roof plan uploaded' }, { status: 404 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(planFile.file_path);

    return NextResponse.json({
      quote,
      planUrl: urlData.publicUrl,
    });
  } catch (error) {
    console.error('Takeoff data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
