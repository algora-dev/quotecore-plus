import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { TwoFactorChallengeForm } from './TwoFactorChallengeForm';

/**
 * Post-login 2FA gate.
 *
 * The middleware sends users here when:
 *   - they have at least one verified TOTP factor, AND
 *   - their current session is still at AAL1 (single-factor)
 *
 * If they somehow land here without an authenticated session or without a
 * verified factor, we route them to the right place instead of trapping them.
 */
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    redirect('/login');
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === 'aal2') {
    // Already verified — bounce back to the original destination (or root).
    redirect(redirectParam && redirectParam.startsWith('/') ? redirectParam : '/');
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = (factorsData?.totp ?? []).find((f) => f.status === 'verified');

  if (!verifiedTotp) {
    // No factor enrolled — nothing to challenge against. Send them through.
    redirect(redirectParam && redirectParam.startsWith('/') ? redirectParam : '/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">
            Two-factor verification
          </h1>
          <p className="text-sm text-slate-500 mb-6 text-center">
            Open your authenticator app and enter the 6-digit code for
            <br />
            <span className="font-medium text-slate-700">
              {verifiedTotp.friendly_name || 'your QuoteCore account'}
            </span>
            .
          </p>

          <TwoFactorChallengeForm factorId={verifiedTotp.id} redirectTo={redirectParam} />
        </div>
      </div>
    </main>
  );
}
