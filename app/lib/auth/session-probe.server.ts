import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import { authFailureCategory } from './auth-errors';
export { authFailureCategory } from './auth-errors';
import { workspaceResumeDestination, type ResumeResult } from './resume-contract';

export type SessionProbeClient = Pick<SupabaseClient<Database>, 'auth' | 'from'>;
export type ProbeObserver = (stage: 'auth' | 'profile' | 'mfa' | 'company', outcome: string) => void;
/** Existing session only: no sign-in, refreshSession, admin key or claimed ID. */
export async function probeSessionDestination(client: SessionProbeClient, requested: string, observe?: ProbeObserver): Promise<ResumeResult> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    const category = authFailureCategory(error);
    observe?.('auth', category);
    return category === 'missing' || category === 'invalid'
      ? { status: 'anonymous', reason: category }
      : { status: 'unavailable' };
  }
  if (!user || user.is_anonymous) { observe?.('auth', 'invalid'); return { status: 'anonymous', reason: 'invalid' }; }
  observe?.('auth', 'verified');
  const { data: profile, error: profileError } = await client.from('users')
    .select('company_id,mfa_required').eq('id', user.id).maybeSingle();
  observe?.('profile', profileError ? 'unavailable' : profile ? 'found' : 'missing');
  if (profileError) return { status: 'unavailable' };

  // Verify the same MFA requirement as the notification actor. Missing MFA
  // metadata is not permission to pass through; the next protected route also
  // enforces its normal policy.
  const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  observe?.('mfa', aalError || !aal ? 'unavailable' : profile?.mfa_required && aal.currentLevel !== 'aal2' ? 'challenge' : 'satisfied');
  if (aalError || !aal) return { status: 'unavailable' };
  if (profile?.mfa_required && aal.currentLevel !== 'aal2' && aal.nextLevel !== 'aal2') return { status: 'unavailable' };

  let destination = '/onboarding';
  if (profile?.company_id) {
    const { data: company, error: companyError } = await client.from('companies')
      .select('slug,onboarding_completed_at').eq('id', profile.company_id).maybeSingle();
    observe?.('company', companyError || !company ? 'unavailable' : company.onboarding_completed_at ? 'ready' : 'onboarding');
    if (companyError || !company) return { status: 'unavailable' };
    if (company.onboarding_completed_at) {
      const resolved = workspaceResumeDestination(requested, company.slug ?? '');
      if (!resolved) return { status: 'unavailable' };
      destination = resolved;
    }
  }
  if (profile?.mfa_required && aal.currentLevel !== 'aal2') {
    return { status: 'mfa_required', destination: `/2fa?redirect=${encodeURIComponent(destination)}` };
  }
  return { status: destination === '/onboarding' ? 'onboarding' : 'authenticated', destination };
}
