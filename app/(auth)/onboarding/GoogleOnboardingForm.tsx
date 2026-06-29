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
  const [language, _setLanguage] = useState('en');
  const [measurement, setMeasurement] = useState<'metric' | 'imperial_ft' | 'imperial_rs'>('metric');
  const [defaultTrade, setDefaultTrade] = useState('roofing');

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
    formData.set('defaultTrade', defaultTrade);
    formData.set('skipRedirect', 'true');

    startTransition(async () => {
      try {
        const result = await completeGoogleOnboarding(formData) as { slug?: string } | undefined;
        if (!result?.slug) {
          setError('Onboarding completed but no workspace slug was returned. Please refresh and try again.');
          return;
        }
        setSavedSlug(result.slug);
        setStep(3);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '';
        setError(errMsg || 'Something went wrong');
      }
    });
  }

  function handleFinish() {
    if (!savedSlug) {
      setError('Workspace slug missing. Please refresh and complete onboarding again.');
      return;
    }
    router.push(`/${savedSlug}?copilot=on`);
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
            className="w-full px-6 py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] mt-2"
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
                      {c.symbol} {c.code} - {c.name}
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
                { value: 'imperial_ft' as const, title: 'Imperial - ft²', subtitle: 'Feet (ft), Square feet (ft²)' },
                { value: 'imperial_rs' as const, title: 'Imperial - Roofing Squares', subtitle: 'Feet (ft), Roofing Squares (RS)' },
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

          {/* Default Trade */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Default Trade</label>
            <p className="text-xs text-slate-500 mb-3">Sets measurement types and tools. You can change this per quote later.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'roofing', label: 'Roofing' },
                { value: 'cladding', label: 'Cladding' },
                { value: 'electrical', label: 'Electrical' },
                { value: 'plumbing', label: 'Plumbing' },
                { value: 'landscaping', label: 'Landscaping' },
                { value: 'concrete', label: 'Concrete' },
                { value: 'flooring', label: 'Flooring' },
                { value: 'tiling', label: 'Tiling' },
                { value: 'painting', label: 'Painting' },
                { value: 'fencing', label: 'Fencing' },
                { value: 'insulation', label: 'Insulation' },
                { value: 'solar', label: 'Solar' },
                { value: 'construction', label: 'Construction' },
                { value: 'foundations', label: 'Foundations' },
                { value: 'generic', label: 'Other / Generic' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDefaultTrade(opt.value)}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition text-left ${
                    defaultTrade === opt.value
                      ? 'border-orange-500 bg-orange-50 text-orange-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-3 border border-slate-300 rounded-full text-sm font-medium hover:bg-slate-50 transition"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              {isPending ? 'Setting up...' : 'Complete Setup →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Q + Tutorials (matches OnboardingForm welcome step) */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 mx-auto rounded-full overflow-hidden ring-2 ring-orange-200 shadow-sm">
              <img src="/q-avatar.png" alt="Q, your QuoteCore+ assistant" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Welcome to QuoteCore+</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              To get started, use <span className="font-semibold text-slate-900">&ldquo;Q&rdquo;</span> &mdash; your
              assistant for any help, guide-me assistance, or general questions to get you up and
              running easily.
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Q is not your average chat bot, he&apos;s kinda smart.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900 mb-1">New here? Check out Tutorials</p>
            <p>
              We&apos;ve put together step-by-step tutorials that walk you through the basics &mdash;
              from creating your first component to sending a quote.{' '}
              <a
                href="/tutorials"
                target="_blank"
                rel="noopener"
                className="text-orange-600 font-medium hover:text-orange-700 underline underline-offset-2"
              >
                View Tutorials
              </a>
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleFinish}
              disabled={isPending}
              className="w-full py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
            >
              {isPending ? 'Setting up...' : 'Get Started'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
