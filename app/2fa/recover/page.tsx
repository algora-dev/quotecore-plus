import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { RecoveryCodeForm } from './RecoveryCodeForm';

/**
 * Recovery-code challenge page. Reachable from the /2fa challenge form via
 * "Use a recovery code instead". Only accessible to users who are already
 * signed in (AAL1) and who have at least one verified TOTP factor.
 *
 * On success, the form action consumes the code, deletes the existing TOTP
 * factor, and redirects the user to settings so they can re-enroll a fresh
 * authenticator.
 */
export default async function TwoFactorRecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectParam } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect('/login');

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === 'aal2') {
    // Already verified — recovery codes shouldn't be needed; bounce them on.
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
            Use a recovery code
          </h1>
          <p className="text-sm text-slate-500 mb-2 text-center">
            Enter one of the recovery codes you saved when you set up 2FA.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-6">
            Heads up: using a recovery code resets your 2FA. Your current authenticator will
            stop working and you&apos;ll be asked to set up a fresh one before regaining full access.
          </p>

          <RecoveryCodeForm redirectTo={redirectParam} />
        </div>
      </div>
    </main>
  );
}
