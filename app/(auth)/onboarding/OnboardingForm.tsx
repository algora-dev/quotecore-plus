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
  const [step, setStep] = useState<'preferences' | 'recovery' | 'copilot'>('preferences');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCopilotChoice(choice: 'tutorial' | 'on' | 'off') {
    const slug = companySlug;
    
    startTransition(async () => {
      try {
        // Save preferences now (deferred until copilot choice)
        await completeOnboarding(companyId, { currency, language, measurement, defaultTrade });
        
        if (choice === 'tutorial') {
          router.push(`/${slug}/components?copilot=on`);
        } else if (choice === 'on') {
          router.push(`/${slug}?copilot=on`);
        } else {
          router.push(`/${slug}?copilot=off`);
        }
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
        <SecurityQuestionsStep onDone={() => setStep('copilot')} />
      </div>
    );
  }

  if (step === 'copilot') {
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

        {/* Prefer-reading-over-Copilot alternative. The new /docs surface
            and the in-app help drawer cover every feature; some users
            learn faster from a written reference than from interactive
            highlights. Surface it here so new users know both options
            exist. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="font-medium text-slate-900 mb-1">Prefer to read it yourself?</p>
          <p>
            Every feature is documented in our{' '}
            <a
              href="/docs"
              target="_blank"
              rel="noopener"
              className="text-orange-600 font-medium hover:text-orange-700 underline underline-offset-2"
            >
              help library
            </a>
            . You can browse it any time from the Help button in the top navigation, or open the in-app help drawer from any page.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleCopilotChoice('tutorial')}
            disabled={isPending}
            className="w-full py-3 bg-black text-white font-semibold rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
          >
            {isPending ? 'Setting up...' : 'Quick Start Components Tutorial'}
          </button>
          <button
            type="button"
            onClick={() => handleCopilotChoice('on')}
            disabled={isPending}
            className="w-full py-3 font-medium rounded-full border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-slate-700 disabled:opacity-50"
          >
            Keep Copilot On, I will explore on my own
          </button>
          <button
            type="button"
            onClick={() => handleCopilotChoice('off')}
            disabled={isPending}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition disabled:opacity-50"
          >
            Turn Copilot Off
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
