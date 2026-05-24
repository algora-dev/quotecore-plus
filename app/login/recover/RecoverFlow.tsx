'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  lookupRecovery,
  verifyRecoveryAnswers,
  finaliseRecovery,
  type RecoveryQuestion,
} from './actions';

type Step =
  | { kind: 'identify' }
  | { kind: 'verify'; oldEmail: string; questions: RecoveryQuestion[] }
  | { kind: 'newEmail'; oldEmail: string }
  | { kind: 'done'; newEmail: string }
  | { kind: 'noRecovery'; message: string };

/**
 * State machine for the recovery flow. Each branch is a discriminated union
 * member; the renderer below dispatches off `step.kind`. We never let the user
 * jump steps client-side - every transition goes through the corresponding
 * server action which is the source of truth (and re-issues the cookie token).
 */
export function RecoverFlow() {
  const [step, setStep] = useState<Step>({ kind: 'identify' });

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Recover your account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Lost access to the email on your account? We can verify it&apos;s you with your security questions and get you back in.
        </p>
      </div>

      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 mb-5">
        <p className="text-xs text-emerald-800">
          <strong>Your data stays put.</strong> Recovery only changes your sign-in email and password. All your quotes, customers, components, files and settings remain unchanged.
        </p>
      </div>

      {step.kind === 'identify' && (
        <IdentifyStep
          onResult={(s) => setStep(s)}
        />
      )}

      {step.kind === 'verify' && (
        <VerifyStep
          oldEmail={step.oldEmail}
          questions={step.questions}
          onSuccess={() => setStep({ kind: 'newEmail', oldEmail: step.oldEmail })}
        />
      )}

      {step.kind === 'newEmail' && (
        <NewEmailStep
          onSuccess={(newEmail) => setStep({ kind: 'done', newEmail })}
        />
      )}

      {step.kind === 'done' && <DoneStep newEmail={step.newEmail} />}

      {step.kind === 'noRecovery' && <ContactSupportCard message={step.message} />}
    </>
  );
}

/* ---------------- Step 1: identify ---------------- */

function IdentifyStep({ onResult }: { onResult: (s: Step) => void }) {
  const [oldEmail, setOldEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await lookupRecovery(oldEmail);
      if (res.ok) {
        onResult({ kind: 'verify', oldEmail: oldEmail.trim().toLowerCase(), questions: res.questions });
      } else if (res.code === 'rate_limited') {
        setError(res.message);
      } else {
        // 'no_recovery_available' - generic surface, may mean no account OR
        // no security questions on the account. We never tell the user which.
        onResult({ kind: 'noRecovery', message: res.message });
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">The email on your account</span>
        <input
          type="email"
          required
          value={oldEmail}
          onChange={(e) => setOldEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !oldEmail}
        className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 transition-all"
      >
        {isPending ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}

/* ---------------- Step 2: verify ---------------- */

function VerifyStep({
  oldEmail,
  questions,
  onSuccess,
}: {
  oldEmail: string;
  questions: RecoveryQuestion[];
  onSuccess: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = questions.map((q) => ({ slot: q.slot, answer: answers[q.slot] ?? '' }));
      const res = await verifyRecoveryAnswers(payload);
      if (res.ok) onSuccess();
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-xs text-slate-500 -mt-2">
        Account: <span className="font-medium text-slate-700">{oldEmail}</span>
      </p>
      {questions.map((q) => (
        <label key={q.slot} className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">{q.question}</span>
          <input
            type="password"
            required
            value={answers[q.slot] ?? ''}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.slot]: e.target.value }))}
            autoComplete="off"
            className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          />
        </label>
      ))}
      <p className="text-xs text-slate-400">Answers are case-insensitive. Extra spaces are ignored.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 transition-all"
      >
        {isPending ? 'Verifying…' : 'Verify answers'}
      </button>
    </form>
  );
}

/* ---------------- Step 3: new email ---------------- */

function NewEmailStep({ onSuccess }: { onSuccess: (newEmail: string) => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await finaliseRecovery(newEmail);
      if (res.ok) onSuccess(res.newEmail);
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        ✓ Identity verified. Enter the email you&apos;d like to use from now on.
      </p>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">New email address</span>
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
        />
      </label>
      <p className="text-xs text-slate-500">
        We&apos;ll change your account email to this address, sign you out of any other sessions, and email you a link to set a new password.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !newEmail}
        className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 transition-all"
      >
        {isPending ? 'Updating…' : 'Update email'}
      </button>
    </form>
  );
}

/* ---------------- Step 4: done ---------------- */

function DoneStep({ newEmail }: { newEmail: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-900">You&apos;re almost back in</h2>
      <p className="text-sm text-slate-600">
        We&apos;ve sent a password reset link to <strong className="text-slate-900">{newEmail}</strong>. Click the link in that email to set a new password and finish signing in.
      </p>
      <p className="text-xs text-slate-400">
        Don&apos;t see it? Check your spam folder. If it doesn&apos;t arrive within a few minutes, contact{' '}
        <a href="mailto:info@quote-core.com" className="text-orange-600 hover:text-orange-700 transition-colors">info@quote-core.com</a>.
      </p>
      <Link
        href="/login"
        className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition mt-2"
      >
        Back to sign in
      </Link>
    </div>
  );
}

/* ---------------- Generic "contact support" fallback ---------------- */

function ContactSupportCard({ message }: { message: string }) {
  // Pre-fill a mailto with subject + body so the user has the easiest path
  // to support. We deliberately don't include the email they entered - we
  // don't want to confirm to a casual observer that the email was/was not
  // recognised in our system.
  const mailto =
    'mailto:info@quote-core.com' +
    '?subject=' +
    encodeURIComponent('QuoteCore+ account recovery - lost email access') +
    '&body=' +
    encodeURIComponent(
      "Hi QuoteCore+ team,\n\nI've lost access to the email on my account and can't recover it through the website. Please help me regain access.\n\nMy company name: \nMy approximate sign-up date: \nAny details you can verify: \n\nThank you,\n"
    );

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-900">{message}</p>
      </div>
      <p className="text-sm text-slate-600">
        Send an email to support and we&apos;ll verify your identity manually. Include your company name and any other details that prove the account is yours.
      </p>
      <a
        href={mailto}
        className="block text-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition-all"
      >
        Contact support
      </a>
      <Link
        href="/login"
        className="block text-center text-xs text-slate-500 hover:text-slate-700 transition"
      >
        ← Back to sign in
      </Link>
    </div>
  );
}
