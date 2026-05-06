'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import {
  unenrollMfaFactor,
  markMfaRequiredAfterEnroll,
  setMfaRequired,
  type MfaFactorSummary,
} from './mfa-actions';
import { generateRecoveryCodes, type RecoveryCodeStatus } from './recovery-actions';
import { ConfirmModal } from '@/app/components/ConfirmModal';


interface Props {
  initialFactors: MfaFactorSummary[];
  /** Whether the current session is fully verified (AAL2). Surfaces a nudge if MFA is enrolled but not active. */
  currentAal: 'aal1' | 'aal2' | null;
  /** Stored mfa_required flag from public.users. Drives the on/off slider. */
  initialMfaRequired: boolean;
}

interface EnrollState {
  factorId: string;
  qrCode: string; // SVG data URI from Supabase
  secret: string; // For manual entry into authenticator apps
  uri: string;    // otpauth:// URI (also useful for manual entry)
  challengeId?: string;
}

export function MfaSection({ initialFactors, currentAal, initialMfaRequired }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const verifiedFactors = initialFactors.filter((f) => f.status === 'verified');
  const unverifiedFactors = initialFactors.filter((f) => f.status !== 'verified');

  const [pending, startTransition] = useTransition();

  // Enrollment flow state
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [friendlyName, setFriendlyName] = useState('');
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Unenroll modal state
  const [pendingUnenroll, setPendingUnenroll] = useState<MfaFactorSummary | null>(null);
  const [unenrollDeleting, setUnenrollDeleting] = useState(false);

  // Enabled-flag slider state (independent of factor existence so the toggle
  // reflects intent immediately).
  const [mfaRequired, setMfaRequiredState] = useState(initialMfaRequired);
  const [togglingMfa, setTogglingMfa] = useState(false);

  const hasVerified = verifiedFactors.length > 0;

  /**
   * Step 1: ask Supabase for a TOTP secret + QR. We deliberately use the
   * *browser* client because mfa.enroll keeps in-memory state on the local
   * GoTrueClient that subsequent challenge/verify calls rely on.
   */
  async function handleStartEnroll() {
    setVerifyError(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: friendlyName.trim() || `Authenticator (${new Date().toLocaleDateString()})`,
    });

    if (error) {
      setVerifyError(error.message);
      return;
    }
    if (!data) {
      setVerifyError('Could not start enrollment. Please try again.');
      return;
    }

    setEnroll({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  }

  /** Step 2: user typed their first 6-digit code. Issue a challenge + verify. */
  async function handleVerify() {
    if (!enroll) return;
    setVerifyError(null);

    // 1. challenge to get a challengeId
    const challengeRes = await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
    if (challengeRes.error) {
      setVerifyError(challengeRes.error.message);
      return;
    }

    // 2. verify with the code typed by the user
    const verifyRes = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challengeRes.data.id,
      code: code.trim(),
    });
    if (verifyRes.error) {
      setVerifyError(verifyRes.error.message);
      return;
    }

    // Verification succeeded. Flip the persistent mfa_required flag on so the
    // middleware will challenge subsequent logins, then clear local state.
    try {
      await markMfaRequiredAfterEnroll();
      setMfaRequiredState(true);
    } catch (err) {
      // Non-fatal: user still has a verified factor, the slider is just a
      // preference. Surface to the console so we notice if Supabase RLS bites us.
      console.error('[MFA] Failed to mark mfa_required after enroll', err);
    }

    setEnroll(null);
    setCode('');
    setFriendlyName('');
    router.refresh();
  }

  async function handleToggleMfa(next: boolean) {
    if (next && !hasVerified) {
      // Can't enable without a factor; nudge the user to enrol instead.
      alert('Add an authenticator factor first before turning 2FA back on.');
      return;
    }
    setTogglingMfa(true);
    const previous = mfaRequired;
    // Optimistic update so the toggle feels responsive; rolled back on error.
    setMfaRequiredState(next);
    try {
      await setMfaRequired(next);
      router.refresh();
    } catch (err) {
      setMfaRequiredState(previous);
      alert(err instanceof Error ? err.message : 'Could not update 2FA preference');
    } finally {
      setTogglingMfa(false);
    }
  }

  /** Cancel an in-flight enrollment (also unenrolls the unverified factor server-side). */
  async function handleCancelEnroll() {
    if (!enroll) return;
    // Best-effort cleanup; if it fails we still close the dialog so the user
    // isn't stuck. Stale unverified factors show up as "Pending" rows below
    // and can be removed manually.
    await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode('');
    setVerifyError(null);
    router.refresh();
  }

  function requestUnenroll(factor: MfaFactorSummary) {
    setPendingUnenroll(factor);
  }

  async function confirmUnenroll() {
    if (!pendingUnenroll) return;
    setUnenrollDeleting(true);
    try {
      await unenrollMfaFactor(pendingUnenroll.id);
      setPendingUnenroll(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove 2FA factor');
    } finally {
      setUnenrollDeleting(false);
    }
  }

  return (
    <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-slate-900">Two-Factor Authentication (2FA)</p>
          {hasVerified && (
            <button
              type="button"
              role="switch"
              aria-checked={mfaRequired}
              disabled={togglingMfa}
              onClick={() => handleToggleMfa(!mfaRequired)}
              title={
                mfaRequired
                  ? '2FA is required at login. Click to disable.'
                  : '2FA is currently disabled. Click to require it at login.'
              }
              className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                mfaRequired ? 'bg-orange-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  mfaRequired ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Use an authenticator app (Google Authenticator, 1Password, Authy, etc.) to add a
          second factor to your login. Optional &mdash; recommended for any account holding
          customer data.
        </p>

        {hasVerified && !mfaRequired && (
          <p className="mt-2 text-xs px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
            2FA is currently <strong>disabled</strong>. Your authenticator factor is still
            saved — flip the switch back on whenever you want to require it at login again.
          </p>
        )}

        {hasVerified && mfaRequired && currentAal === 'aal1' && (
          <p className="mt-2 text-xs px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
            2FA is enrolled but this session is not yet verified at the second-factor level.
            Log out and log back in to activate full protection.
          </p>
        )}

        {verifiedFactors.length > 0 && (
          <div className="mt-3 space-y-2">
            {verifiedFactors.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-100 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
                <span className="text-sm text-slate-800 truncate">
                  {f.friendly_name || 'Authenticator'}
                </span>
                {f.created_at && (
                  <span className="text-[11px] text-slate-400 ml-auto">
                    Added {new Date(f.created_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => requestUnenroll(f)}
                  className="ml-2 text-xs text-red-600 hover:text-red-700 hover:underline"
                  disabled={pending}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {unverifiedFactors.length > 0 && (
          <div className="mt-3 space-y-2">
            {unverifiedFactors.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 p-2 bg-white border border-amber-200 rounded-lg"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-700">
                  Pending
                </span>
                <span className="text-sm text-slate-800 truncate">
                  {f.friendly_name || 'Unverified authenticator'}
                </span>
                <button
                  type="button"
                  onClick={() => requestUnenroll(f)}
                  className="ml-auto text-xs text-red-600 hover:text-red-700 hover:underline"
                  disabled={pending}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Enrollment dialog */}
        {enroll && (
          <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Set up your authenticator</h3>
            <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1 mb-3">
              <li>Open your authenticator app and add a new account.</li>
              <li>Scan this QR code, or enter the secret below manually.</li>
              <li>Type the 6-digit code from your app to verify.</li>
            </ol>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div
                className="w-44 h-44 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center"
                // Supabase returns the QR as an inline SVG data URI.
                // eslint-disable-next-line @next/next/no-img-element
              >
                <img src={enroll.qrCode} alt="2FA QR code" className="w-full h-full" />
              </div>

              <div className="flex-1 w-full">
                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  Manual entry secret
                </label>
                <code className="block text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1.5 break-all">
                  {enroll.secret}
                </code>

                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mt-3 mb-1">
                  6-digit code from your app
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />

                {verifyError && (
                  <p className="mt-2 text-xs text-red-600">{verifyError}</p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await handleVerify();
                      })
                    }
                    disabled={pending || code.length !== 6}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.45)] disabled:opacity-50 disabled:hover:shadow-none"
                  >
                    {pending ? 'Verifying...' : 'Verify and enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await handleCancelEnroll();
                      })
                    }
                    disabled={pending}
                    className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* "Add factor" button */}
        {!enroll && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Label this device (optional, e.g. 'iPhone Authenticator')"
              maxLength={64}
              className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await handleStartEnroll();
                })
              }
              disabled={pending}
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
            >
              {hasVerified ? 'Add another factor' : 'Set up 2FA'}
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={pendingUnenroll !== null}
        title="Remove 2FA factor"
        description={
          pendingUnenroll
            ? `Remove "${pendingUnenroll.friendly_name || 'this authenticator'}"? You won't be asked for a code at login until you set up a new factor.`
            : ''
        }
        confirmLabel="Remove"
        pendingLabel="Removing..."
        pending={unenrollDeleting}
        onCancel={() => {
          if (!unenrollDeleting) setPendingUnenroll(null);
        }}
        onConfirm={confirmUnenroll}
      />

    </div>
  );
}

/**
 * Recovery codes panel.
 *
 * Rendered as a separate card section so we can mount it under the same Security
 * heading as the rest of MFA without bloating the main MFA component.
 *
 * Codes are optional and not auto-generated, matching Shaun's preference ("make
 * it optional for them to download the codes rather than force them"). The UI
 * surfaces a soft suggestion when MFA is enrolled but no codes exist yet.
 */
export function RecoveryCodesPanel({
  initialStatus,
  hasVerifiedMfa,
}: {
  initialStatus: RecoveryCodeStatus;
  hasVerifiedMfa: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<RecoveryCodeStatus>(initialStatus);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const hasCodes = status.total > 0;
  const lowRemaining = status.remaining <= 2 && status.remaining > 0;
  const allUsed = status.total > 0 && status.remaining === 0;

  async function generate() {
    setError(null);
    try {
      const newCodes = await generateRecoveryCodes();
      setCodes(newCodes);
      setStatus({ total: newCodes.length, used: 0, remaining: newCodes.length });
      setConfirmRegen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate recovery codes');
    }
  }

  function download() {
    if (!codes) return;
    const lines = [
      'QuoteCore+ Recovery Codes',
      '------------------------------',
      'Each code can be used ONCE if you lose access to your authenticator.',
      'Using a code will reset your 2FA — you will be asked to re-enroll a fresh authenticator.',
      '',
      ...codes,
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quotecore-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  async function copyAll() {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">Recovery codes</p>
        <p className="text-xs text-slate-500 mt-0.5">
          One-time codes you can use to sign in if you lose access to your authenticator.
          Each code works once. Using one resets your 2FA so you&apos;ll re-enroll a fresh
          authenticator app.
        </p>

        {hasVerifiedMfa && !hasCodes && (
          <p className="mt-2 text-xs px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
            You have 2FA enabled but no recovery codes. We strongly recommend generating a
            batch and storing them somewhere safe (password manager, printed copy in a drawer,
            etc.). They&apos;re your only backup if your authenticator is lost.
          </p>
        )}

        {hasCodes && !codes && (
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-medium">Status:</span> {status.remaining} of {status.total} codes
            remaining {status.used > 0 && <span className="text-slate-500">({status.used} used)</span>}
          </p>
        )}

        {hasCodes && lowRemaining && !codes && (
          <p className="mt-2 text-xs px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
            Only {status.remaining} recovery code{status.remaining === 1 ? '' : 's'} left.
            Generate a fresh batch soon to keep a healthy buffer.
          </p>
        )}

        {allUsed && !codes && (
          <p className="mt-2 text-xs px-2 py-1.5 rounded bg-red-50 border border-red-200 text-red-800">
            All recovery codes have been used. Generate a new batch.
          </p>
        )}

        {/* Display the freshly-generated codes once. */}
        {codes && (
          <div className="mt-3 p-3 border border-slate-200 rounded-lg bg-white">
            <p className="text-xs font-medium text-slate-900 mb-1">
              Save these codes somewhere safe.
            </p>
            <p className="text-[11px] text-amber-700 mb-2">
              We won&apos;t show them again. If you close this dialog without copying or
              downloading them, you&apos;ll have to regenerate the batch.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {codes.map((c) => (
                <code
                  key={c}
                  className="text-xs font-mono text-center bg-slate-50 border border-slate-200 rounded py-1.5"
                >
                  {c}
                </code>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={download}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.4)]"
              >
                Download as .txt
              </button>
              <button
                type="button"
                onClick={copyAll}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Copy all
              </button>
              <button
                type="button"
                onClick={() => setCodes(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50 ml-auto"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!hasCodes && (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await generate();
                })
              }
              disabled={pending}
              className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
            >
              {pending ? 'Generating...' : 'Generate recovery codes'}
            </button>
          )}
          {hasCodes && (
            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              disabled={pending}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmRegen}
        title="Regenerate recovery codes"
        description="Your existing recovery codes will be invalidated immediately. Anyone holding the old codes will no longer be able to use them. You'll get a fresh batch to download."
        confirmLabel="Regenerate"
        pendingLabel="Generating..."
        pending={pending}
        destructive={false}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() => startTransition(async () => { await generate(); })}
      />
    </div>
  );
}
