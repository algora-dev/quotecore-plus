'use server';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/app/lib/marketing/unsubscribeToken';

/**
 * Public unsubscribe confirmation for agent-sent marketing emails.
 * Writes to marketing_suppressions (separate from the company-scoped
 * message_suppressions). Idempotent upsert.
 */
export async function confirmMarketingUnsubscribe(token: string): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.ADMIN_SIGNUPS_API_KEY;
  if (!secret) return { ok: false, error: 'not_configured' };

  const email = verifyUnsubscribeToken(token, secret);
  if (!email) return { ok: false, error: 'invalid_token' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('marketing_suppressions')
    .upsert({ email, source: 'agent_email' }, { onConflict: 'email' });

  if (error) {
    console.error('[marketing-unsubscribe] upsert failed:', error);
    return { ok: false, error: 'insert_failed' };
  }
  return { ok: true };
}
