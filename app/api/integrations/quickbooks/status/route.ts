import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { getQboConnection } from '@/app/lib/integrations/quickbooks/qbo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/quickbooks/status
 * Returns the company's QuickBooks connection state (never returns tokens).
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

    const connection = await getQboConnection(companyId);
    return NextResponse.json({
      connected: !!connection,
      environment: connection?.environment ?? null,
      connectedAt: connection?.created_at ?? null,
    });
  } catch (err) {
    console.error('[qbo/status] error:', err);
    return NextResponse.json({ error: 'Failed to load QuickBooks status' }, { status: 500 });
  }
}
