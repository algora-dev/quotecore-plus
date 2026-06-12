'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from './actions';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';
import { SecurityQuestionsStep } from './SecurityQuestionsStep';

interface Props {
  companyId: string;
  companyName: string;
  companySlug: string;
  currentCurrency: string;
  currentLanguage: string;
  currentMeasurement: 'metric' | 'imperial_ft' | 'imperial_rs' | 'imperial';
}

export function OnboardingForm({ 
  companyId, 
  companyName: _companyName,
  companySlug,
  currentCurrency, 
  currentLanguage, 
  currentMeasurement 
}: Props) {
  const [currency, setCurrency] = useState(currentCurrency);
  const [language, _setLanguage] = useState(currentLanguage);
  // Normalise legacy 'imperial' to 'imperial_rs' so the picker doesn't render unselected.
  const [measurement, setMeasurement] = useState<'metric' | 'imperial_ft' | 'imperial_rs'>(
    currentMeasurement === 'imperial' ? 'imperial_rs' : (currentMeasurement as 'metric' | 'imperial_ft' | 'imperial_rs')
  );
  const [defaultTrade, setDefaultTrade] = useState('roofing');
  const [step, setStep] = useState<'preferences' | 'recovery' | 'welcome'>('preferences');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Final onboarding step: save preferences, then drop the user into the app.
  // Q (the assistant / guide-me system) stays ON by default - the welcome
  // copy promotes it, and it's the user's primary way to get help.
  function finishOnboarding() {
    const slug = companySlug;
    startTransition(async () => {
      try {
        await completeOnboarding(companyId, { currency, language, measurement, defaultTrade });
        router.push(`/${slug}?copilot=on`);
      } catch (err) {
        console.error('Failed to complete onboarding:', err);
        router.push(`/${slug}`);
      }
    });
  }

  if (step === 'recovery') {
    return (
      <div className="space-y-6">
        {/* Step indicator: 1 done, 2 active, 3 pending */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-emerald-500 text-white">&#10003;</div>
          <div className="flex-1 h-0.5 bg-emerald-500" />
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-black text-white">2</div>
          <div className="flex-1 h-0.5 bg-slate-200" />
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-slate-200 text-slate-500">3</div>
        </div>
        <SecurityQuestionsStep onDone={() => setStep('welcome')} />
      </div>
    );
  }

  if (step === 'welcome') {
    return (
      <div className="space-y-6">
        {/* Step indicator: 1 + 2 done, 3 active */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-emerald-500 text-white">&#10003;</div>
          <div className="flex-1 h-0.5 bg-emerald-500" />
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-emerald-500 text-white">&#10003;</div>
          <div className="flex-1 h-0.5 bg-emerald-500" />
          <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-black text-white">3</div>
        </div>

        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full overflow-hidden ring-2 ring-orange-200 shadow-sm">
            <img src="/q-avatar.png" alt="Q, your QuoteCore+ assistant" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Welcome to QuoteCore+</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            To get started, use <span className="font-semibold text-slate-900">“Q”</span> - your
            assistant for any help, guide-me assistance, or general questions to get you up and
            running easily.
          </p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Q is not your average chat bot, he&apos;s kinda smart.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={finishOnboarding}
            disabled={isPending}
            className="w-full py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
          >
            {isPending ? 'Setting up...' : 'Get Started'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator: 1 active, 2 + 3 pending */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-black text-white">1</div>
        <div className="flex-1 h-0.5 bg-slate-200" />
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-slate-200 text-slate-500">2</div>
        <div className="flex-1 h-0.5 bg-slate-200" />
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-slate-200 text-slate-500">3</div>
      </div>

      {/* Currency Selection */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Default Currency</span>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            All component library prices will be entered in this currency. You can change quote currency later, but prices won&apos;t auto-convert.
          </p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
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
        </label>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            <strong>Important:</strong> Choose carefully! Changing this later won&apos;t convert existing component prices.
          </p>
        </div>
      </div>

      {/* Measurement System */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Measurement System</span>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            Default for new quotes (you can change per-quote later)
          </p>
        </label>
        <div className="grid grid-cols-1 gap-3">
          {[
            { value: 'metric' as const, title: 'Metric', subtitle: 'Meters (m), Square meters (m²)' },
            { value: 'imperial_ft' as const, title: 'Imperial - ft²', subtitle: 'Feet (ft), Square feet (ft²)' },
            { value: 'imperial_rs' as const, title: 'Imperial - Roofing Squares', subtitle: 'Feet (ft), Roofing Squares (RS)' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMeasurement(opt.value)}
              className={`p-4 rounded-lg border-2 transition text-left ${
                measurement === opt.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="font-semibold">{opt.title}</div>
              <div className="text-xs text-slate-500 mt-1">{opt.subtitle}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Default Trade */}
      <div className="space-y-3">
        <div>
          <span className="text-sm font-semibold text-slate-900">Default Trade</span>
          <p className="text-xs text-slate-500 mt-1 mb-3">
            Sets measurement types, tools, and terminology across the app. You can change this per quote later.
          </p>
        </div>
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

      {/* Next Button */}
      <button
        type="button"
        onClick={() => setStep('recovery')}
        className="w-full py-4 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition"
      >
        Next →
      </button>
    </div>
  );
}
