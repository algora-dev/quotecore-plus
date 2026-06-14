'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Add a new note to a quote. The note is scoped to the user's company and
 * stamped with the current user's id.
 */
export async function addQuoteNote(
  quoteId: string,
  title: string,
  body: string,
): Promise<{ id: string }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const trimTitle = title.trim();
  const trimBody = body.trim();
  if (!trimTitle) throw new Error('Note title is required.');
  if (!trimBody) throw new Error('Note body is required.');

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

  if (error || !data) throw new Error(error?.message ?? 'Failed to create note.');
  revalidatePath('/');
  return { id: data.id };
}

/**
 * Update the title and/or body of an existing note.
 * RLS ensures only the note's company members can update it.
 */
export async function updateQuoteNote(
  noteId: string,
  title: string,
  body: string,
): Promise<void> {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const trimTitle = title.trim();
  const trimBody = body.trim();
  if (!trimTitle) throw new Error('Note title is required.');
  if (!trimBody) throw new Error('Note body is required.');

  const { error } = await supabase
    .from('quote_notes')
    .update({ title: trimTitle, body: trimBody })
    .eq('id', noteId);

  if (error) throw new Error(error.message);
  revalidatePath('/');
}

/**
 * Delete a note by id. RLS ensures only company members can delete it.
 */
export async function deleteQuoteNote(noteId: string): Promise<void> {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('quote_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw new Error(error.message);
  revalidatePath('/');
}
