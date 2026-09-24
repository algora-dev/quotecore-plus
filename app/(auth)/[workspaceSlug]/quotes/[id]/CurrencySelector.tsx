'use client';
import { useTransition, useId } from 'react';
import { QcSelect } from '@/app/components/ui/v2/QcField';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import { updateQuoteCurrency } from '../actions';
import { useRouter } from 'next/navigation';
import { CURRENCY_GROUPS } from '@/app/lib/currency/currencies';

interface Props {
  quoteId: string;
  currentCurrency: string | null;  // null = using company default
  companyDefaultCurrency: string;
  workspaceSlug: string;
}

export function CurrencySelector({ quoteId, currentCurrency, companyDefaultCurrency, workspaceSlug: _workspaceSlug }: Props) {
  const { notify, ask, feedback } = useQcFeedback();
  const selectId = useId();
  const effectiveCurrency = currentCurrency || companyDefaultCurrency;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(newCurrency: string) {
    // Warn if changing away from company default
    if (newCurrency !== companyDefaultCurrency) {
      const confirmed = await ask({
        title: 'Change currency?',
        description: `Your component library prices are in ${companyDefaultCurrency}.
` +
          `Changing this quote to ${newCurrency} changes the display symbol only.

` +
          `Prices will NOT be converted automatically.

` +
          `Keep quotes in ${companyDefaultCurrency}, or manually adjust component rates if needed.`,
        confirmLabel: 'Change currency',
        cancelLabel: `Keep ${effectiveCurrency}`,
      });

      if (!confirmed) return;
    }
    
    startTransition(async () => {
      try {
        // If selecting company default, set to null (inherit)
        const valueToSet = newCurrency === companyDefaultCurrency ? null : newCurrency;
        await updateQuoteCurrency(quoteId, valueToSet);
        router.refresh();
      } catch (err) {
        console.error('Failed to update currency:', err);
        await notify('Failed to update currency. Please try again.');
      }
    });
  }

  return (
    <>
    {feedback}
    <div className="qb-currency">
      <label htmlFor={selectId} className="qc-label" title="Currency display format (prices are NOT auto-converted)">
        Currency:
      </label>
      <QcSelect
        id={selectId}
        value={effectiveCurrency}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="qb-currency-select"
        title="Changes display symbol only - prices are NOT converted"
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
      </QcSelect>
      
      {isPending && (
        <span className="qc-help" role="status">Updating...</span>
      )}
    </div>
    </>
  );
}
