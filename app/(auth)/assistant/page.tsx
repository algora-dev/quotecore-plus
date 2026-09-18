import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { getCurrentProfile } from '@/app/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * /assistant - PWA start_url for the assistant home-screen icon. Sends an
 * anonymous visitor to login (and back here), then redirects into their
 * workspace's assistant page. The installed icon therefore opens straight
 * into the assistant-only experience, never the main app.
 */
export default async function AssistantEntryPoint() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login?next=/assistant');
  }
  const { company } = await loadCompanyContext();
  redirect(`/${company.slug}/assistant`);
}
