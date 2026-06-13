import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

/**
 * GET /api/invoices/catalog-rows?catalogId=<uuid>&search=<string>
 * Returns catalog rows for the invoice line picker.
 * catalog_rows stores data in raw_row (JSON) and search_text.
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await requireCompanyContext();
    const catalogId = req.nextUrl.searchParams.get('catalogId');
    const search = req.nextUrl.searchParams.get('search') ?? '';

    if (!catalogId) return NextResponse.json({ rows: [] });

    const supabase = await createSupabaseServerClient();

    // Verify catalog belongs to company
    const { data: catalog } = await supabase
      .from('catalogs')
      .select('id')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!catalog) return NextResponse.json({ rows: [] });

    let query = supabase
      .from('catalog_rows')
      .select('id, catalog_id, raw_row, search_text, row_index')
      .eq('catalog_id', catalogId)
      .order('row_index')
      .limit(100);

    if (search.trim()) {
      query = query.ilike('search_text', `%${search.trim()}%`);
    }

    const { data: rows } = await query;

    // Return rows with raw_row data; client will extract label/price from it
    return NextResponse.json({ rows: rows ?? [] });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 401 });
  }
}
