'use server';

import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

/**
 * Message Center settings (company-level).
 *
 * For now a single persisted preference: `notify_on_recipient_view` —
 * "Notify me when recipients open (Read)." The recipient-view STATUS always
 * updates regardless of this toggle; the toggle ONLY controls whether a Read
 * alert is created (enforced in app/lib/recipient/stampViewActions.ts).
 */

export async function getInboxSettings(): Promise<{ notifyOnRecipientView: boolean }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('companies')
    .select('notify_on_recipient_view')
    .eq('id', profile.company_id)
    .maybeSingle();
  return { notifyOnRecipientView: data?.notify_on_recipient_view ?? true };
}

export async function updateNotifyOnRecipientView(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('companies')
    .update({ notify_on_recipient_view: enabled })
    .eq('id', profile.company_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
