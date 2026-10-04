'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireAdmin } from '@/app/lib/supabase/server';

/**
 * Admin-only writes to the demo master switches (demo_control row 1).
 * These are the owner's emergency brakes - no deploy needed, effective on
 * the next server read.
 */
export async function setDemoSwitch(field: 'demo_enabled' | 'ai_enabled', value: boolean) {
  const profile = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('demo_control')
    .update({
      [field]: value,
      updated_at: new Date().toISOString(),
      updated_by: (profile as { id?: string }).id ?? null,
    })
    .eq('id', 1);
  if (error) throw new Error(`Failed to update ${field}: ${error.message}`);
  revalidatePath('/admin/demo');
}
