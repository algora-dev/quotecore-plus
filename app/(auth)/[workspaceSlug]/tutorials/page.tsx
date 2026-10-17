import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { LEGACY_Q_ENABLED } from '@/app/lib/assistant/legacyQ';
import { TutorialsClient } from './TutorialsClient';

/**
 * /[workspaceSlug]/tutorials - the onboarding hub.
 *
 * Server shell resolves the workspace base + the per-user assistant pref
 * (which gates the "Walk me through with Q" CTA), then hands off to the client
 * grid + modal.
 */
export default async function TutorialsPage() {
  const { company } = await loadCompanyContext();
  const base = `/${company.slug}`;

  // Legacy Q kill switch (owner 2026-10-17): skip the preference query and
  // hard-off the Q CTA while Q is hidden in-app.
  let assistantEnabled = false;
  if (LEGACY_Q_ENABLED) {
    const profile = await getCurrentProfile();
    const supabase = await createSupabaseServerClient();
    const { data: assistantPref } = await supabase
      .from('users')
      .select('assistant_enabled')
      .eq('id', profile.id)
      .maybeSingle();
    assistantEnabled =
      (assistantPref as { assistant_enabled?: boolean } | null)?.assistant_enabled ?? true;
  }

  return <TutorialsClient base={base} assistantEnabled={assistantEnabled} />;
}
