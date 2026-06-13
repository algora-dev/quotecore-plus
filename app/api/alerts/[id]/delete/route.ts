import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Delete a single alert. Used by the Message Center inbox per-row delete.
 * Hard delete, scoped to the caller's company (RLS + explicit company_id
 * filter as defence-in-depth).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
