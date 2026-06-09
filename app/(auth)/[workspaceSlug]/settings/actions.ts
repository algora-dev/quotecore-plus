'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface CompanySettings {
  companyName: string;
  userName: string;
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial_ft' | 'imperial_rs';
  materialMargin: number;
  laborMargin: number;
  /** Phase 8 (Generic Trades): optional; only written when provided. */
  defaultTrade?: 'roofing' | 'cladding' | 'generic' | 'electrical' | 'plumbing' | 'landscaping' | 'flooring' | 'tiling' | 'foundations' | 'insulation' | 'painting' | 'fencing' | 'concrete' | 'construction' | null;
}

export async function updateCompanySettings(
  companyId: string,
  _userId: string, // Ignored - we use the authenticated user's ID instead
  settings: CompanySettings
) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify user owns this company (use server-side profile, not client params)
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  // Update company name
  const { error: companyError } = await supabase
    .from('companies')
    .update({
      name: settings.companyName,
      default_currency: settings.currency,
      default_language: settings.language,
      default_measurement_system: settings.measurement,
      default_material_margin_percent: settings.materialMargin,
      default_labor_margin_percent: settings.laborMargin,
      // H-05 (Gerald round-5): only write default_trade when the server
      // flag is on, so a crafted request can't flip the trade while the
      // generic-trades rollout is off.
      ...(settings.defaultTrade != null && process.env.GENERIC_TRADES_V1_ENABLED === 'true'
        ? { default_trade: settings.defaultTrade }
        : {}),
    })
    .eq('id', companyId);

  if (companyError) {
    console.error('[Settings] Company update failed:', companyError);
    throw new Error('Failed to update company settings');
  }

  // Update user name (use authenticated user ID, not client-provided)
  const { error: userError } = await supabase
    .from('users')
    .update({
      full_name: settings.userName,
    })
    .eq('id', profile.id);

  if (userError) {
    console.error('[Settings] User update failed:', userError);
    throw new Error('Failed to update user settings');
  }



  // Revalidate any pages that depend on company settings
  revalidatePath('/');
}

/**
 * NOTE: the old per-user `updateEmailNotificationsEnabled` master was removed
 * in favour of per-event email toggles in the Message Center (see
 * inbox/settings-actions.ts). The `users.email_notifications_enabled` column
 * is retained in the DB for back-compat but is no longer written or read.
 */

/** Toggle the per-user Chat Assistant (Q) visibility. */
export async function updateAssistantEnabled(enabled: boolean): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ assistant_enabled: enabled } as any)
    .eq('id', profile.id);

  if (error) {
    console.error('[Settings] updateAssistantEnabled failed:', error);
    throw new Error('Failed to update Chat Assistant preference');
  }
  revalidatePath('/[workspaceSlug]', 'layout');
}
