import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { getConnection } from '@/app/lib/integrations/xero/xero';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/xero/status
 * Returns the company's Xero connection state (never returns tokens).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();
    const companyId = profile?.company_id as string | undefined;
    if (!companyId) {
      return NextResponse.json({ error: 'No company context' }, { status: 400 });
    }

    const connection = await getConnection(companyId);
    return NextResponse.json({
      connected: !!connection,
      tenantName: connection?.tenant_name ?? null,
      connectedAt: connection?.created_at ?? null,
    });
  } catch (err) {
    console.error('[xero/status] error:', err);
    return NextResponse.json({ error: 'Failed to load Xero status' }, { status: 500 });
  }
}
