import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, type Database } from '@/app/lib/supabase/server';
import { getQboConnection, revokeQboToken } from '@/app/lib/integrations/quickbooks/qbo';

export const dynamic = 'force-dynamic';

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * POST /api/integrations/quickbooks/disconnect
 * Revokes tokens (best-effort) and deletes local connection rows.
 */
export async function POST(req: NextRequest) {
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

    const admin = createServiceClient();

    const connection = await getQboConnection(companyId);
    if (connection) {
      await revokeQboToken(connection.refresh_token);
      const { error: delError } = await admin
        .from('qbo_connections')
        .delete()
        .eq('company_id', companyId);
      if (delError) throw new Error(delError.message);
    }

    await admin
      .from('integrations')
      .update({
        connection_status: 'disconnected',
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('provider', 'quickbooks');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[qbo/disconnect] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to disconnect QuickBooks' },
      { status: 500 }
    );
  }
}
