'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { verifyQuoteOwnership } from '@/app/lib/auth/ownership';

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Add a new note to a quote. The note is scoped to the user's company and
 * stamped with the current user's id.
 */
export async function addQuoteNote(
  quoteId: string,
  title: string,
  body: string,
): Promise<ActionResult> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify the quote belongs to this user's company before inserting — prevents
  // cross-tenant note linkage via guessed/known foreign quote UUIDs (H-02).
  await verifyQuoteOwnership(supabase, quoteId, profile.company_id);

  const trimTitle = title.trim();
  const trimBody = body.trim();
  if (!trimTitle) return { ok: false, error: 'Note title is required.' };
  if (!trimBody) return { ok: false, error: 'Note body is required.' };
  if (trimTitle.length > 100) return { ok: false, error: 'Title must be 100 characters or fewer.' };
  if (trimBody.length > 2000) return { ok: false, error: 'Note must be 2,000 characters or fewer.' };

  const { data, error } = await supabase
    .from('quote_notes')
    .insert({
      quote_id: quoteId,
      company_id: profile.company_id,
      created_by_user_id: profile.id,
      title: trimTitle,
      body: trimBody,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create note.' };
  revalidatePath('/');
  return { ok: true, id: data.id };
}

/**
 * Update the title and/or body of an existing note.
 * RLS ensures only the note's company members can update it.
 */
export async function updateQuoteNote(
  noteId: string,
  title: string,
  body: string,
): Promise<ActionResult> {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const trimTitle = title.trim();
  const trimBody = body.trim();
  if (!trimTitle) return { ok: false, error: 'Note title is required.' };
  if (!trimBody) return { ok: false, error: 'Note body is required.' };
  if (trimTitle.length > 100) return { ok: false, error: 'Title must be 100 characters or fewer.' };
  if (trimBody.length > 2000) return { ok: false, error: 'Note must be 2,000 characters or fewer.' };

  const { error } = await supabase
    .from('quote_notes')
    .update({ title: trimTitle, body: trimBody })
    .eq('id', noteId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

/**
 * Delete a note by id. RLS ensures only company members can delete it.
 */
export async function deleteQuoteNote(noteId: string): Promise<ActionResult> {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('quote_notes')
    .delete()
    .eq('id', noteId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}
