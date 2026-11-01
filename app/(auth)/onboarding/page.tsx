import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getCurrentProfile } from '@/app/lib/supabase/server';

/**
 * Onboarding is retired (owner decision 2026-11-01): signup is now email-only
 * (magic link) or Google, and /auth/callback auto-provisions the free
 * workspace directly. This route only remains so old links and bookmarks land
 * somewhere sensible: authed users with a company go to their workspace,
 * everyone else goes to the new signup page.
 */
export const dynamic = 'force-dynamic';

export default async function OnboardingRedirect() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signup');

  try {
    const profile = await getCurrentProfile();
    if (profile?.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('slug')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (company?.slug) redirect(`/${company.slug}`);
    }
  } catch {
    // No usable profile: fall through to signup, which re-provisions.
  }
  redirect('/signup');
}
