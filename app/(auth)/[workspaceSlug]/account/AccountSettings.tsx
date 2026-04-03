'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCompanySettings, updateUserProfile } from './actions';

interface Props {
  company: {
    id: string;
    name: string | null;
    default_tax_rate: number;
    default_currency: string | null;
    default_language: string | null;
  };
  profile: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export function AccountSettings({ company, profile }: Props) {
  // Company fields
  const [companyName, setCompanyName] = useState(company.name || '');
  const [taxRate, setTaxRate] = useState(company.default_tax_rate.toString());
  const [currency, setCurrency] = useState(company.default_currency || 'NZD');
  
  // User fields
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [email, setEmail] = useState(profile.email);
  
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function saveCompanySettings() {
    if (!companyName.trim()) {
      alert('Company name is required');
      return;
    }

    const taxRateNum = parseFloat(taxRate);
    if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      alert('Tax rate must be between 0 and 100');
      return;
    }

    startTransition(async () => {
      try {
        await updateCompanySettings(company.id, {
          name: companyName.trim(),
          default_tax_rate: taxRateNum,
          default_currency: currency,
        });
        router.refresh();
        alert('Company settings saved!');
      } catch (err) {
        alert('Failed to save: ' + (err as Error).message);
      }
    });
  }

  async function saveUserProfile() {
    if (!fullName.trim()) {
      alert('Name is required');
      return;
    }

    startTransition(async () => {
      try {
        await updateUserProfile(profile.id, {
          full_name: fullName.trim(),
        });
        router.refresh();
        alert('Profile saved!');
      } catch (err) {
        alert('Failed to save: ' + (err as Error).message);
      }
    });
  }

  return (
    <>
      {/* Company Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <h2 className="text-xl font-semibold">Company Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
            <p className="text-xs text-slate-500 mt-1">
              New quotes will use this tax rate by default
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <optgroup label="Dollar Currencies">
                <option value="NZD">NZD — New Zealand Dollar</option>
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="USD">USD — US Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="SGD">SGD — Singapore Dollar</option>
                <option value="HKD">HKD — Hong Kong Dollar</option>
              </optgroup>
              <optgroup label="Other Currencies">
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="JPY">JPY — Japanese Yen</option>
                <option value="CNY">CNY — Chinese Yuan</option>
                <option value="CHF">CHF — Swiss Franc</option>
                <option value="INR">INR — Indian Rupee</option>
              </optgroup>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Component library prices are in this currency
            </p>
          </div>

          <button
            onClick={saveCompanySettings}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Company Settings'}
          </button>
        </div>
      </div>

      {/* Primary Contact */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <h2 className="text-xl font-semibold">Primary Contact</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Email cannot be changed (contact support if needed)
            </p>
          </div>

          <button
            onClick={saveUserProfile}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </>
  );
}
