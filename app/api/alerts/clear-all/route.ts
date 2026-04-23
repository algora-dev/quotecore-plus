import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function POST() {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('company_id', profile.company_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
