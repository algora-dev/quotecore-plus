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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        await completeOnboarding(companyId, {
          currency,
          language,
          measurement,
        });
        
        // Redirect to overview page
        const slug = companyName.toLowerCase().replace(/\s+/g, '-');
        router.push(`/${slug}`);
      } catch (err) {
        console.error('Onboarding failed:', err);
        alert('Failed to complete setup. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
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
        className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isPending ? 'Completing Setup...' : 'Complete Setup →'}
      </button>
    </form>
  );
}
