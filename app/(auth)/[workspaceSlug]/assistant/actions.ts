'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export type ConversationRow = {
  id: string;
  title: string | null;
  last_active_at: string;
};

export async function createConversation(title: string | null): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // RLS: conversations are owner-only; company_id must match the member's.
  const { data, error } = await supabase
    .from('smart_assistant_conversations')
    .insert({
      company_id: profile.company_id,
      user_id: profile.id,
      title: title?.trim().slice(0, 80) || null,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create conversation.' };
  return { ok: true, id: data.id };
}

export async function renameConversation(id: string, title: string): Promise<{ ok: boolean }> {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('smart_assistant_conversations')
    .update({ title: title.trim().slice(0, 80), updated_at: new Date().toISOString() })
    .eq('id', id); // RLS scopes to owner
  revalidatePath('/assistant', 'page');
  return { ok: true };
}
