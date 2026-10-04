import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { probeSessionDestination } from '@/app/lib/auth/session-probe.server';
import type { ResumeResult } from '@/app/lib/auth/resume-contract';

export const dynamic = 'force-dynamic';

/** Keep the existing installed start_url and identity. The middleware persists
 * any refreshed cookies; this page makes one normal authenticated membership
 * lookup, never swallows a profile/network failure as a fabricated logout. */
export default async function AssistantEntryPoint() {
  let result: ResumeResult;
  try { result = await probeSessionDestination(await createSupabaseServerClient(), '/assistant'); }
  catch { result = { status: 'unavailable' }; }
  if ('destination' in result) redirect(result.destination);
  if (result.status === 'anonymous') redirect('/login?redirect=%2Fassistant');
  return <main className="min-h-screen flex items-center justify-center px-6">
    <div className="max-w-md text-center" role="status">
      <h1 className="text-xl font-semibold">Your workspace could not be opened yet</h1>
      <p className="mt-3">Reconnect and try again. A temporary verification problem does not mean you have signed out.</p>
      <a href="/assistant" className="inline-block min-h-11 mt-4 underline">Try again</a>
      <p><a href="/login?redirect=%2Fassistant" className="inline-block min-h-11 underline">Go to sign-in</a></p>
    </div>
  </main>;
}
