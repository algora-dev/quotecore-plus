'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeGoogleOnboarding } from './actions';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';


interface Props {
  defaultName: string;
  defaultEmail: string;
}

export function GoogleOnboardingForm({ defaultName, defaultEmail }: Props) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const router = useRouter();


  // Step 1 fields
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState(defaultName);

  // Step 2 fields
  const [currency, setCurrency] = useState('NZD');
  const [language, setLanguage] = useState('en');
  const [measurement, setMeasurement] = useState<'metric' | 'imperial_ft' | 'imperial_rs'>('metric');

  function handleNext() {
    if (!companyName.trim() || !fullName.trim()) {
      setError('Company name and your name are required');
      return;
    }
    setError(null);
    setStep(2);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('companyName', companyName);
    formData.set('fullName', fullName);
    formData.set('currency', currency);
    formData.set('language', language);
    formData.set('measurement', measurement);
    formData.set('skipRedirect', 'true');

    startTransition(async () => {
      try {
        const result = await completeGoogleOnboarding(formData) as { slug?: string } | undefined;
        if (!result?.slug) {
          // Server should always return { slug } when skipRedirect=true. If not, we've got nothing
          // safe to redirect to — don't guess (computed slugs collide / 404). Surface the error.
          setError('Onboarding completed but no workspace slug was returned. Please refresh and try again.');
          return;
        }
        setSavedSlug(result.slug);
        setStep(3);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '';
        // skipRedirect=true is set above, so a NEXT_REDIRECT here means the server bypassed it —
        // surface as an error rather than guessing a slug from the company name.
        setError(errMsg || 'Something went wrong');
      }
    });
  }

  function handleCopilotChoice(choice: 'tutorial' | 'on' | 'off') {
    if (!savedSlug) {
      setError('Workspace slug missing. Please refresh and complete onboarding again.');
      return;
    }
    const slug = savedSlug;
    if (choice === 'tutorial') {
      router.push(`/${slug}/components?copilot=on`);
    } else if (choice === 'on') {
      router.push(`/${slug}?copilot=on`);
    } else {
      router.push(`/${slug}?copilot=off`);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Signed in indicator */}
      <div className="flex items-center gap-2 p-3 mb-6 bg-emerald-50 border border-emerald-200 rounded-lg">
        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-emerald-700">Signed in as <strong>{defaultEmail}</strong></span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === 1 ? 'bg-black text-white' : 'bg-emerald-500 text-white'}`}>
          {step > 1 ? '✓' : '1'}
        </div>
        <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === 2 ? 'bg-black text-white' : step > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
          {step > 2 ? '✓' : '2'}
        </div>
        <div className={`flex-1 h-0.5 ${step > 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === 3 ? 'bg-black text-white' : 'bg-slate-200 text-slate-500'}`}>
          3
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Company name</span>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="Your Company Ltd"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Your name</span>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="John Smith"
            />
          </label>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <button
            type="button"
            onClick={handleNext}
            className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors mt-2"
          >
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5">
          {/* Currency */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">💰 Default Currency</label>
            <p className="text-xs text-slate-500 mb-2">All prices will be entered in this currency</p>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              {CURRENCY_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.currencies.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Measurement */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">📏 Measurement System</label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {[
                { value: 'metric' as const, title: 'Metric', subtitle: 'Meters (m), Square meters (m²)' },
                { value: 'imperial_ft' as const, title: 'Imperial — ft²', subtitle: 'Feet (ft), Square feet (ft²)' },
                { value: 'imperial_rs' as const, title: 'Imperial — Roofing Squares', subtitle: 'Feet (ft), RS (1 RS = 100 ft²)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMeasurement(opt.value)}
                  className={`p-3 rounded-lg border-2 transition text-left ${
                    measurement === opt.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{opt.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Setting up...' : 'Complete Setup →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Copilot Introduction */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Meet Copilot</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              We have an interactive tutorial system called Copilot that walks you through each step of the app. It highlights the buttons and fields you need to use, so you can learn as you go.
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              You can switch Copilot on or off anytime from the navigation bar or in Account Settings.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 text-center">We recommend starting with these tutorials:</p>
            <div className="flex gap-2 justify-center">
              <span className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">Adding Components</span>
              <span className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">Creating a Quote</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleCopilotChoice('tutorial')}
              className="w-full py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Start with Components Tutorial
            </button>
            <button
              type="button"
              onClick={() => handleCopilotChoice('on')}
              className="w-full py-3 font-medium rounded-full border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-slate-700"
            >
              Turn Copilot On, I will explore on my own
            </button>
            <button
              type="button"
              onClick={() => handleCopilotChoice('off')}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
