'use client';
import { useState, useTransition } from 'react';
import { updateQuoteCurrency } from '../../actions';
import { useRouter } from 'next/navigation';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';

interface Props {
  quoteId: string;
  currentCurrency: string | null;  // null = using company default
  companyDefaultCurrency: string;
  workspaceSlug: string;
}

export function CurrencySelector({ quoteId, currentCurrency, companyDefaultCurrency, workspaceSlug }: Props) {
  const effectiveCurrency = currentCurrency || companyDefaultCurrency;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(newCurrency: string) {
    startTransition(async () => {
      try {
        // If selecting company default, set to null (inherit)
        const valueToSet = newCurrency === companyDefaultCurrency ? null : newCurrency;
        await updateQuoteCurrency(quoteId, valueToSet);
        router.refresh();
      } catch (err) {
        console.error('Failed to update currency:', err);
        alert('Failed to update currency. Please try again.');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="currency-selector" className="text-sm font-medium text-slate-700">
        Currency:
      </label>
      <select
        id="currency-selector"
        value={effectiveCurrency}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {/* Show company default with indicator */}
        <option value={companyDefaultCurrency}>
          {companyDefaultCurrency} {currentCurrency === null ? '(Company Default)' : ''}
        </option>
        
        {/* Grouped currency options */}
        {CURRENCY_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.currencies
              .filter(c => c.code !== companyDefaultCurrency)  // Don't duplicate company default
              .map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      
      {isPending && (
        <span className="text-xs text-slate-500">Updating...</span>
      )}
    </div>
  );
}
