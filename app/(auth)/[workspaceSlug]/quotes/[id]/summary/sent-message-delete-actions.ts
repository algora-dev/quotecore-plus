'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';

export type DeleteSentMessageResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

/**
 * Hard-delete a single outbound message and its cascaded replies.
 *
 * Ownership: scoped via `outbound_messages.company_id` against the
 * caller's profile.company_id. RLS would block cross-company access
 * anyway; this is belt-and-braces and gives us a typed error.
 *
 * Cascade: `outbound_message_replies.message_id` has ON DELETE CASCADE
 * so the reply rows go with the parent. Audit trail survives in Vercel
 * function logs.
 */
export async function deleteSentMessage(messageId: string): Promise<DeleteSentMessageResult> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('outbound_messages')
    .delete()
    .eq('id', messageId)
    .eq('company_id', profile.company_id)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Message not found.' };
  }

  console.log(`[messages/delete] user=${profile.id} company=${profile.company_id} message=${messageId}`);
  revalidatePath('/');
  return { ok: true, deletedCount: data.length };
}

/**
 * Hard-delete every outbound message associated with a given quote.
 * Same ownership + cascade rules as `deleteSentMessage`. Returns the
 * count so the UI can show "Removed N messages" feedback.
 */
export async function deleteAllSentMessagesForQuote(
  quoteId: string,
): Promise<DeleteSentMessageResult> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('outbound_messages')
    .delete()
    .eq('related_quote_id', quoteId)
    .eq('company_id', profile.company_id)
    .select('id');

  if (error) return { ok: false, error: error.message };

  console.log(
    `[messages/delete-all] user=${profile.id} company=${profile.company_id} quote=${quoteId} count=${data?.length ?? 0}`,
  );
  revalidatePath('/');
  return { ok: true, deletedCount: data?.length ?? 0 };
}
