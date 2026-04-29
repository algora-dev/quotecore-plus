'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from './actions';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';


interface Props {
  companyId: string;
  companyName: string;
  currentCurrency: string;
  currentLanguage: string;
  currentMeasurement: 'metric' | 'imperial';
}

export function OnboardingForm({ 
  companyId, 
  companyName, 
  currentCurrency, 
  currentLanguage, 
  currentMeasurement 
}: Props) {
  const [currency, setCurrency] = useState(currentCurrency);
  const [language, setLanguage] = useState(currentLanguage);
  const [measurement, setMeasurement] = useState(currentMeasurement);
  const [step, setStep] = useState<'preferences' | 'copilot'>('preferences');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();


  async function handleSavePreferences() {
    startTransition(async () => {
      try {
        await completeOnboarding(companyId, {
          currency,
          language,
          measurement,
        });
        setStep('copilot');
      } catch (err) {
        console.error('Onboarding failed:', err);
        alert('Failed to complete setup. Please try again.');
      }
    });
  }

  function handleCopilotChoice(choice: 'tutorial' | 'on' | 'off') {
    const slug = companyName.toLowerCase().replace(/\s+/g, '-');
    if (choice === 'tutorial') {
      router.push(`/${slug}/components?copilot=on`);
    } else if (choice === 'on') {
      router.push(`/${slug}?copilot=on`);
    } else {
      router.push(`/${slug}?copilot=off`);
    }
  }

  if (step === 'copilot') {
    return (
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
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSavePreferences(); }} className="space-y-6">
      {/* Currency Selection */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">💰 Default Currency</span>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            All component library prices will be entered in this currency. You can change quote currency later, but prices won't auto-convert.
          </p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            disabled={isPending}
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
        </label>
        <div className="bg-amber-50 border border-amber-200 rounded-full p-3">
          <p className="text-xs text-amber-800">
            ⚠️ <strong>Important:</strong> Choose carefully! Changing this later won't convert existing component prices.
          </p>
        </div>
      </div>

      {/* Language Selection */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">🌐 Language</span>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            UI language (currently only English is supported)
          </p>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            disabled={isPending}
          >
            <option value="en">English</option>
            {/* Future languages will be added here */}
          </select>
        </label>
      </div>

      {/* Measurement System */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">📏 Measurement System</span>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            Default for new quotes (you can change per-quote later)
          </p>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setMeasurement('metric')}
            disabled={isPending}
            className={`p-4 rounded-lg border-2 transition ${
              measurement === 'metric'
                ? 'border-orange-500 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="font-semibold">Metric</div>
            <div className="text-xs text-slate-500 mt-1">Meters (m), Square meters (m²)</div>
          </button>
          <button
            type="button"
            onClick={() => setMeasurement('imperial')}
            disabled={isPending}
            className={`p-4 rounded-lg border-2 transition ${
              measurement === 'imperial'
                ? 'border-orange-500 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="font-semibold">Imperial</div>
            <div className="text-xs text-slate-500 mt-1">Feet (ft), Roof squares (Rs)</div>
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-4 bg-black text-white font-semibold rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isPending ? 'Completing Setup...' : 'Complete Setup →'}
      </button>
    </form>
  );
}
