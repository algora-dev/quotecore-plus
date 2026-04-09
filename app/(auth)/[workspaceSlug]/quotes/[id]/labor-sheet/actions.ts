'use server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveLaborSheetLines(
  quoteId: string,
  lines: Array<{
    id: string;
    lineType: 'component' | 'custom';
    componentId?: string;
    text: string;
    amount: number;
    showPrice: boolean;
    showUnits: boolean;
    sortOrder: number;
    isVisible: boolean;
    includeInTotal: boolean;
  }>
) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Delete existing lines for this quote
  await supabase
    .from('labor_sheet_lines')
    .delete()
    .eq('quote_id', quoteId);

  // Insert new lines
  if (lines.length > 0) {
    const insertData = lines.map(line => ({
      quote_id: quoteId,
      line_type: line.lineType,
      quote_component_id: line.componentId || null,
      custom_text: line.text,
      custom_amount: line.amount,
      show_price: line.showPrice,
      show_units: line.showUnits,
      sort_order: line.sortOrder,
      is_visible: line.isVisible,
      include_in_total: line.includeInTotal,
    }));

    const { error } = await supabase
      .from('labor_sheet_lines')
      .insert(insertData);

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/quotes/${quoteId}/labor-sheet`);
  revalidatePath(`/quotes/${quoteId}/labor`);
}

export async function loadLaborSheetLines(quoteId: string) {
  'use server';
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify quote belongs to company
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();

  if (!quote || quote.company_id !== profile.company_id) {
    throw new Error('Quote not found');
  }

  // Load saved lines
  const { data: lines, error } = await supabase
    .from('labor_sheet_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order');

  if (error) throw new Error(error.message);

  return lines || [];
}
