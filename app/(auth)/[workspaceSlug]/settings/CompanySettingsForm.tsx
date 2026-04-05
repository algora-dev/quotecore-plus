'use client';
import { useState, useTransition } from 'react';
import { updateCompanySettings } from './actions';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';

interface Props {
  companyId: string;
  currentCurrency: string;
  currentLanguage: string;
  currentMeasurement: 'metric' | 'imperial';
  currentMaterialMargin: number;
  currentLaborMargin: number;
}

export function CompanySettingsForm({
  companyId,
  currentCurrency,
  currentLanguage,
  currentMeasurement,
  currentMaterialMargin,
  currentLaborMargin,
}: Props) {
  const [currency, setCurrency] = useState(currentCurrency);
  const [language, setLanguage] = useState(currentLanguage);
  const [measurement, setMeasurement] = useState(currentMeasurement);
  const [materialMargin, setMaterialMargin] = useState(currentMaterialMargin.toString());
  const [laborMargin, setLaborMargin] = useState(currentLaborMargin.toString());
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);

    // Validate margins
    const matMargin = parseFloat(materialMargin);
    const labMargin = parseFloat(laborMargin);

    if (isNaN(matMargin) || matMargin < 0 || matMargin > 100) {
      setSaveMessage({ type: 'error', text: 'Material margin must be between 0 and 100%' });
      return;
    }

    if (isNaN(labMargin) || labMargin < 0 || labMargin > 100) {
      setSaveMessage({ type: 'error', text: 'Labor margin must be between 0 and 100%' });
      return;
    }

    startTransition(async () => {
      try {
        await updateCompanySettings(companyId, {
          currency,
          language,
          measurement,
          materialMargin: matMargin,
          laborMargin: labMargin,
        });

        setSaveMessage({ type: 'success', text: '✓ Settings saved successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (err) {
        console.error('Settings update failed:', err);
        setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Currency Selection */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900">💰 Default Currency</span>
          <p className="text-xs text-gray-600 mt-1 mb-2">
            All component library prices will be entered in this currency
          </p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
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
        <div className="bg-amber-50 border-2 border-orange-400 rounded-full p-3">
          <p className="text-xs text-gray-900">
            ⚠️ <strong>Important:</strong> Changing currency won't convert existing component prices
          </p>
        </div>
      </div>

      {/* Language Selection */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900">🌐 Language</span>
          <p className="text-xs text-gray-600 mt-1 mb-2">
            UI language (currently only English is supported)
          </p>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            disabled={isPending}
          >
            <option value="en">English</option>
          </select>
        </label>
      </div>

      {/* Measurement System */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-900">📏 Measurement System</span>
          <p className="text-xs text-gray-600 mt-1 mb-2">
            Default units for quotes and measurements
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-full cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value="metric"
                checked={measurement === 'metric'}
                onChange={(e) => setMeasurement(e.target.value as 'metric' | 'imperial')}
                disabled={isPending}
                className="w-4 h-4"
              />
              <span className="text-sm">Metric (meters, square meters)</span>
            </label>
            <label className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-full cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value="imperial"
                checked={measurement === 'imperial'}
                onChange={(e) => setMeasurement(e.target.value as 'metric' | 'imperial')}
                disabled={isPending}
                className="w-4 h-4"
              />
              <span className="text-sm">Imperial (feet, square feet)</span>
            </label>
          </div>
        </label>
      </div>

      {/* Profit Margins */}
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">💸 Default Profit Margins</h2>
        <p className="text-sm text-gray-600 mb-6">
          These margins will be automatically applied to new quotes. You can adjust them per quote in the Review tab.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Material Margin */}
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-900">Material Margin</span>
              <p className="text-xs text-gray-600 mt-1 mb-2">
                Profit margin added to material costs
              </p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={materialMargin}
                  onChange={(e) => setMaterialMargin(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="15"
                  disabled={isPending}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  %
                </span>
              </div>
            </label>
            <p className="text-xs text-gray-500">
              Example: 15% margin on $1,000 materials = $150 profit
            </p>
          </div>

          {/* Labor Margin */}
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-900">Labor Margin</span>
              <p className="text-xs text-gray-600 mt-1 mb-2">
                Profit margin added to labor costs
              </p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={laborMargin}
                  onChange={(e) => setLaborMargin(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="20"
                  disabled={isPending}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  %
                </span>
              </div>
            </label>
            <p className="text-xs text-gray-500">
              Example: 20% margin on $500 labor = $100 profit
            </p>
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-full p-4">
          <p className="text-sm text-blue-900">
            <strong>💡 Note:</strong> Margins are hidden from customers. They only see the final total price including your profit.
          </p>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`p-4 rounded-lg ${
            saveMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : 'bg-red-50 border border-red-300 text-red-900'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
