'use server';

import { redirect } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../lib/supabase/server';

export async function createTemplateGroup(templateId: string, formData: FormData) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const sortOrderRaw = String(formData.get('sort_order') || '0').trim();
  const sortOrder = Number(sortOrderRaw || 0);

  if (!name) {
    throw new Error('Group name is required.');
  }

  const { error } = await supabase.from('template_item_groups').insert({
    template_id: templateId,
    name,
    description: description || null,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/templates/${templateId}`);
}

export async function updateTemplateGroup(
  templateId: string,
  groupId: string,
  formData: FormData
) {
  await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const sortOrderRaw = String(formData.get('sort_order') || '0').trim();
  const sortOrder = Number(sortOrderRaw || 0);

  if (!name) {
    throw new Error('Group name is required.');
  }

  const { error } = await supabase
    .from('template_item_groups')
    .update({
      name,
      description: description || null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    })
    .eq('id', groupId)
    .eq('template_id', templateId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/templates/${templateId}`);
}
