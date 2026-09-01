// Step 1: How do you want to price this job? Nothing pre-selected.
// 'measure a plan' -> inline plan upload appears BELOW, proceed -> in-tool takeoff station.
// 'already have measurements' -> plan/actual sub-choice appears BELOW -> entry step.

'use client';

import { useRef, useState } from 'react';
import type { EntryMode, HaveSubMode } from './types';
import { useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { useSupplierConfig } from './supplierConfig';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';

export function EntryModeStep({
  entryMode, setEntryMode, haveSubMode, setHaveSubMode, planFile, setPlanFile, onNext,
}: {
  entryMode: EntryMode | null;
  setEntryMode: (m: EntryMode | null) => void;
  haveSubMode: HaveSubMode | null;
  setHaveSubMode: (m: HaveSubMode | null) => void;
  planFile: File | null;
  setPlanFile: (f: File | null) => void;
  onNext: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfPicker = usePdfPagePicker();

  async function onFileChosen(raw: File | null) {
    if (!raw) { setPlanFile(null); return; }
    const isPdf = raw.type === 'application/pdf' || /\.pdf$/i.test(raw.name);
    if (isPdf) {
      // PDFs: convert the chosen page to a PNG client-side. 50 MB cap because
      // only one page is ultimately used.
      if (raw.size > 50 * 1024 * 1024) {
        setPlanFile(null);
        return;
      }
      const converted = await pdfPicker.convertIfNeeded(raw);
      setPlanFile(converted); // null when the user cancels the page picker
    } else {
      setPlanFile(raw);
    }
  }
  const { config } = useSupplierConfig();
  const canNext = entryMode === 'measure'
    ? planFile !== null
    : entryMode === 'have' && haveSubMode !== null;

  function pick(mode: EntryMode) {
    // switching choice resets the dependent state
    setEntryMode(mode);
    setHaveSubMode(null);
    if (mode !== 'measure') setPlanFile(null);
  }

  return (
    <div className="space-y-6">
      {/* Step 0: customer sign-in - trade pricing / supplier-assigned pricing.
          Large, unmissable, above everything else. Hidden when already signed
          in or when the login feature is off. */}
      {config.features.login && (
        <SignInCard />
      )}

      <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">How do you want to price this job?</h2>
        <p className="mt-1 text-sm text-slate-500">Measure from a plan, or enter measurements you already have.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ChoiceCard
            selected={entryMode === 'measure'}
            title="I need to measure a plan"
            desc="Upload your plan and measure roof areas and lines right here."
            onClick={() => pick('measure')}
          />
          <ChoiceCard
            selected={entryMode === 'have'}
            title="I already have my measurements"
            desc="Enter your measurements - plan or actual/site values."
            onClick={() => pick('have')}
          />
        </div>
      </div>

      {/* Upload plan - appears directly below when 'measure a plan' is chosen */}
      {entryMode === 'measure' && (
        <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition p-4 md:p-6">
          <h3 className="text-base font-semibold text-slate-900">Upload your plan</h3>
          <p className="mt-1 text-sm text-slate-500">PDF or image. You&apos;ll measure roof areas and lines on it in the next step.</p>

          <button
            onClick={() => fileRef.current?.click()}
            className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center transition hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer"
          >
            {planFile ? (
              <>
                <span className="text-sm font-semibold text-slate-900">{planFile.name}</span>
                <span className="mt-1 text-xs text-slate-400">Click to replace</span>
              </>
            ) : (
              <>
                <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <span className="mt-2 text-sm font-medium text-slate-600">Click to upload your plan</span>
                <span className="mt-1 text-xs text-slate-400">PDF, PNG, JPG</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => { onFileChosen(e.target.files?.[0] ?? null); e.currentTarget.value = ''; }}
          />
        </div>
      )}

      {/* Plan vs actual sub-choice - appears directly below when 'have' is chosen */}
      {entryMode === 'have' && (
        <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition p-4 md:p-6">
          <h3 className="text-base font-semibold text-slate-900">What kind of measurements do you have?</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ChoiceCard
              selected={haveSubMode === 'plan'}
              title="Plan measurements"
              desc="Measurements off a plan. We'll convert them using the roof pitch."
              onClick={() => setHaveSubMode('plan')}
            />
            <ChoiceCard
              selected={haveSubMode === 'actual'}
              title="Actual / site measurements"
              desc="Real-world measurements taken on site. No conversion needed."
              onClick={() => setHaveSubMode('actual')}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canNext}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(37,99,235,0.5)] disabled:opacity-40"
        >
          {entryMode === 'measure' ? 'Proceed to measuring' : 'Next'}
        </button>
      </div>

      {/* PDF page picker modal (client-side pdfjs) */}
      {pdfPicker.modal}
    </div>
  );
}

function ChoiceCard({ title, desc, selected, onClick }: { title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-4 transition cursor-pointer ${selected ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'border-slate-900' : 'border-slate-300'}`}>
          {selected && <span className="h-2 w-2 rounded-full bg-slate-900" />}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
        </div>
      </div>
    </button>
  );
}

/** Step-0 customer sign-in: large full-width card above the entry-mode
 *  choice. Signed-in users see a confirmation chip instead of the button. */
function SignInCard() {
  const { user, signInWithGoogle, signInWithEmail, openAuthModal } = useFreeToolsAuth();
  const { config } = useSupplierConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  if (user) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {(user.email ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
            <p className="text-xs text-blue-600 font-medium">Trade pricing active</p>
          </div>
        </div>
      </div>
    );
  }

  async function submit() {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (password) {
        const { error } = await signInWithEmail(email, password);
        if (error) setError(error);
      } else {
        openAuthModal('signin');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Collapsed summary - click to expand the sign-in options */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-blue-50/40 cursor-pointer"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Customer sign in</div>
          <p className="mt-0.5 text-xs text-slate-500">
            Have trade pricing with {config.name}? Sign in with your email or Google to see your prices throughout.
          </p>
        </div>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
      <div className="border-t border-slate-200 bg-slate-900 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="md:flex-1">
          <h2 className="text-base font-bold text-white">Customer sign in</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Have trade pricing with {config.name}? Sign in with your email or Google to see your prices throughout.
          </p>
        </div>
        <button
          onClick={() => void signInWithGoogle()}
          className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/20" />
        <span className="text-[11px] text-slate-500">or</span>
        <div className="h-px flex-1 bg-white/20" />
      </div>
      <div className="mt-3 flex flex-col md:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password (optional)"
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !email.trim()}
          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] text-slate-500">
        No account? Just enter your email with no password - we&apos;ll email you a secure login link.
      </p>
      </div>
      )}
    </div>
  );
}
