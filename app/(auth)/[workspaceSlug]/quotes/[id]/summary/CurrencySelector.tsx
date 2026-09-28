'use client';
import { useTransition, useState } from 'react';
import '@/app/components/ui/v2/qc.css';
import { updateQuoteCurrency } from '../../actions';
import { useRouter } from 'next/navigation';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';

interface Props {
  quoteId: string;
  currentCurrency: string | null;  // null = using company default
  companyDefaultCurrency: string;
  workspaceSlug: string;
}

export function CurrencySelector({ quoteId, currentCurrency, companyDefaultCurrency, workspaceSlug: _workspaceSlug }: Props) {
  const [saveError, setSaveError] = useState('');
  const effectiveCurrency = currentCurrency || companyDefaultCurrency;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(newCurrency: string) {
    setSaveError('');
    startTransition(async () => {
      try {
        // If selecting company default, set to null (inherit)
        const valueToSet = newCurrency === companyDefaultCurrency ? null : newCurrency;
        await updateQuoteCurrency(quoteId, valueToSet);
        router.refresh();
      } catch (err) {
        console.error('Failed to update currency:', err);
        setSaveError('Currency was not updated. Please try again.');
      }
    });
  }

  return (
    <div data-qc-ui="v2" className="flex flex-wrap items-center gap-2">
      <label htmlFor="currency-selector" className="text-sm font-medium text-slate-700">
        Currency:
      </label>
      <select
        id="currency-selector"
        value={effectiveCurrency}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="qc-select max-w-full" aria-invalid={!!saveError} aria-describedby={saveError ? 'currency-save-error' : undefined}
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
                  {currency.code} - {currency.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      
      {saveError && <p id="currency-save-error" role="alert" className="w-full text-sm text-red-700">{saveError}</p>}
      {isPending && (
        <span className="text-xs text-slate-500">Updating...</span>
      )}
    </div>
  );
}
