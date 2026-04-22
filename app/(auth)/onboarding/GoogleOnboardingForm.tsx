'use client';

import { useState, useTransition } from 'react';
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

  // Step 1 fields
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState(defaultName);

  // Step 2 fields
  const [currency, setCurrency] = useState('NZD');
  const [language, setLanguage] = useState('en');
  const [measurement, setMeasurement] = useState<'metric' | 'imperial'>('metric');

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

    startTransition(async () => {
      try {
        await completeGoogleOnboarding(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
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
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step === 2 ? 'bg-black text-white' : 'bg-slate-200 text-slate-500'}`}>
          2
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
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setMeasurement('metric')}
                className={`p-3 rounded-lg border-2 transition text-left ${
                  measurement === 'metric'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-medium text-sm">Metric</div>
                <div className="text-xs text-slate-500 mt-0.5">Meters, m²</div>
              </button>
              <button
                type="button"
                onClick={() => setMeasurement('imperial')}
                className={`p-3 rounded-lg border-2 transition text-left ${
                  measurement === 'imperial'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-medium text-sm">Imperial</div>
                <div className="text-xs text-slate-500 mt-0.5">Feet, sq ft</div>
              </button>
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
    </form>
  );
}
