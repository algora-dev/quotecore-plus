'use server';
import { revalidatePath } from 'next/cache';
import { writePricingSetupPreference } from '@/app/lib/pricing-setup/preferences';
import { requireCompanyContext } from '@/app/lib/supabase/server';

export async function setPricingSetupPreference(alwaysOpenLibrary: boolean): Promise<{ ok: boolean; message?: string }> {
  try {
    await requireCompanyContext();
    await writePricingSetupPreference(alwaysOpenLibrary);
    revalidatePath('/[workspaceSlug]/pricing', 'page');
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not save your choice. Please try again.' };
  }
}
