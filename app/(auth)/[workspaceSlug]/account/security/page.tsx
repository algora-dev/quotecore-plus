import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { PasswordSection } from '@/app/(auth)/[workspaceSlug]/settings/PasswordSection';
import { MfaSection, RecoveryCodesPanel } from '@/app/(auth)/[workspaceSlug]/settings/MfaSection';
import { listMfaFactors, getMfaRequired } from '@/app/(auth)/[workspaceSlug]/settings/mfa-actions';
import { getRecoveryCodeStatus } from '@/app/(auth)/[workspaceSlug]/settings/recovery-actions';
import { SecurityQuestionsSection } from '@/app/(auth)/[workspaceSlug]/settings/SecurityQuestionsSection';
import { listSecurityQuestions } from '@/app/(auth)/[workspaceSlug]/settings/security-questions-actions';

/**
 * /account/security — password, 2FA, recovery codes, recovery questions.
 *
 * NB: the Change-Email card lives on the /account index, not here, because
 * it's tied to the user's identity rather than account-defence settings.
 * The two are related but conceptually distinct: Change-Email is "how do I
 * sign in" (Account), while Security is "how do I prove it's me" (Security).
 */
export default async function SecurityPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Six previously-sequential reads, now parallel. None of them depend on
  // each other's results so the prior await chain was needlessly serial
  // — the biggest single contributor to the slow /account/security load.
  const [
    userRes,
    authUserRes,
    mfa,
    mfaRequired,
    recoveryStatus,
    securityQuestions,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('email')
      .eq('id', profile.id)
      .single(),
    supabase.auth.getUser(),
    listMfaFactors(),
    getMfaRequired(),
    getRecoveryCodeStatus(),
    listSecurityQuestions(),
  ]);

  const user = userRes.data;
  const authUser = authUserRes.data.user;
  const authProvider = authUser?.app_metadata?.provider || 'email';
  const userEmail = user?.email || authUser?.email || '';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Security</h2>
        <p className="text-sm text-slate-500 mt-1">Protect access to your account.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-security">
        <PasswordSection authProvider={authProvider} userEmail={userEmail} />
        <MfaSection
          initialFactors={mfa.factors}
          currentAal={mfa.currentAal}
          initialMfaRequired={mfaRequired}
        />
        <RecoveryCodesPanel
          initialStatus={recoveryStatus}
          hasVerifiedMfa={mfa.factors.some((f) => f.status === 'verified')}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-recovery">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Account Recovery</h3>
          <p className="text-sm text-slate-500 mt-1">
            Set questions only you can answer. Used by support to verify you if you ever lose access to your email.
          </p>
        </div>
        <SecurityQuestionsSection initialQuestions={securityQuestions} />
      </div>
    </section>
  );
}
