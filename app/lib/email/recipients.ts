/**
 * Recipient resolution for company-scoped alert emails.
 *
 * For an in-app alert that targets a company (quote accepted/declined, revision
 * requested), we email every user who:
 *   - belongs to that company
 *   - has email_notifications_enabled = TRUE
 *
 * For security emails we never use this helper — those go to the single user
 * the event is about, regardless of the toggle.
 */

import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';

export type AlertRecipient = {
  id: string;
  email: string;
  fullName: string | null;
};

/**
 * Returns the company-scoped users who should receive an in-app alert email.
 * Respects the per-user email_notifications_enabled toggle.
 *
 * If `preferUserId` is supplied, that user is moved to the front of the list
 * (used to keep the quote creator in slot 0 for nicer "Hi {name}" greetings
 * in single-recipient cases — does not change which users receive the email).
 */
export async function getCompanyAlertRecipients(
  companyId: string,
  preferUserId?: string | null
): Promise<AlertRecipient[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, email_notifications_enabled')
    .eq('company_id', companyId)
    .eq('email_notifications_enabled', true);

  if (error) {
    console.error('[email] getCompanyAlertRecipients failed:', error);
    return [];
  }
  const list: AlertRecipient[] = (data ?? [])
    .filter((u): u is { id: string; email: string; full_name: string | null; email_notifications_enabled: boolean } =>
      Boolean(u && u.email)
    )
    .map((u) => ({ id: u.id, email: u.email, fullName: u.full_name ?? null }));

  if (preferUserId) {
    list.sort((a, b) => (a.id === preferUserId ? -1 : b.id === preferUserId ? 1 : 0));
  }
  return list;
}

/**
 * Look up a single user by id (used for security emails).
 * Ignores the email_notifications_enabled flag — security alerts always send.
 */
export async function getUserById(userId: string): Promise<AlertRecipient | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', userId)
    .single();
  if (error || !data?.email) return null;
  return { id: data.id, email: data.email, fullName: data.full_name ?? null };
}

/** Look up a single user by auth user id via the email match in public.users. */
export async function getUserByEmail(email: string): Promise<AlertRecipient | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', email)
    .single();
  if (error || !data?.email) return null;
  return { id: data.id, email: data.email, fullName: data.full_name ?? null };
}
