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
 * Hard-delete a specific set of outbound messages by id. Used by the
 * multi-select bulk action on the Sent Messages panel.
 *
 * Single round-trip: the previous UX called `deleteSentMessage` once
 * per row which made deleting 10 messages cost 10 network calls. This
 * action batches into one DELETE … WHERE id = ANY(...). RLS still
 * filters cross-company rows, and `company_id` is also matched as
 * belt-and-braces.
 *
 * Returns the number actually removed so the UI can distinguish
 * "all gone" from "some rows were already deleted in another tab".
 */
export async function deleteSentMessagesBulk(
  messageIds: string[],
): Promise<DeleteSentMessageResult> {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return { ok: false, error: 'No messages selected.' };
  }
  // Cheap upper bound so a malformed payload can't ask Postgres to
  // process an arbitrarily large IN list. The Sent Messages panel only
  // ever shows the latest 10, so 100 is generous headroom.
  if (messageIds.length > 100) {
    return { ok: false, error: 'Too many messages selected (max 100).' };
  }
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('outbound_messages')
    .delete()
    .in('id', messageIds)
    .eq('company_id', profile.company_id)
    .select('id');

  if (error) return { ok: false, error: error.message };

  console.log(
    `[messages/delete-bulk] user=${profile.id} company=${profile.company_id} requested=${messageIds.length} removed=${data?.length ?? 0}`,
  );
  revalidatePath('/');
  return { ok: true, deletedCount: data?.length ?? 0 };
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
