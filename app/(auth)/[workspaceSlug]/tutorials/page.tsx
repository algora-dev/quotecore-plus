import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';
import { TutorialsClient } from './TutorialsClient';

/**
 * /[workspaceSlug]/tutorials — the onboarding hub.
 *
 * Server shell resolves the workspace base + the per-user assistant pref
 * (which gates the "Walk me through with Q" CTA), then hands off to the client
 * grid + modal.
 */
export default async function TutorialsPage() {
  const { company } = await loadCompanyContext();
  const base = `/${company.slug}`;

  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const { data: assistantPref } = await supabase
    .from('users')
    .select('assistant_enabled')
    .eq('id', profile.id)
    .maybeSingle();
  const assistantEnabled =
    (assistantPref as { assistant_enabled?: boolean } | null)?.assistant_enabled ?? true;

  return <TutorialsClient base={base} assistantEnabled={assistantEnabled} />;
}
