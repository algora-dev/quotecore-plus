'use client';
import { useState, useTransition } from 'react';
import { savePaymentDetails, type PaymentDetails } from './payment-details-actions';

interface Props {
  current: PaymentDetails;
}

export function PaymentDetailsForm({ current }: Props) {
  const [accountName, setAccountName] = useState(current.accountName);
  const [bankName, setBankName] = useState(current.bankName);
  const [accountNumber, setAccountNumber] = useState(current.accountNumber);
  const [sortCode, setSortCode] = useState(current.sortCode);
  const [paymentLink, setPaymentLink] = useState(current.paymentLink);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        await savePaymentDetails({ accountName, bankName, accountNumber, sortCode, paymentLink });
        setMessage({ type: 'success', text: 'Payment details saved.' });
      } catch {
        setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
      }
    });
  }

  const hasDetails = accountName || bankName || accountNumber || sortCode || paymentLink;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preview card */}
      {hasDetails && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">
            Preview - how this appears on invoices
          </p>
          <div className="space-y-1.5 text-sm">
            {accountName && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Account Name</span>
                <span className="font-medium text-slate-900">{accountName}</span>
              </div>
            )}
            {bankName && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Bank</span>
                <span className="font-medium text-slate-900">{bankName}</span>
              </div>
            )}
            {accountNumber && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Account Number</span>
                <span className="font-mono font-medium text-slate-900">{accountNumber}</span>
              </div>
            )}
            {sortCode && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Sort Code</span>
                <span className="font-mono font-medium text-slate-900">{sortCode}</span>
              </div>
            )}
            {paymentLink && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Payment Link</span>
                <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="font-medium text-orange-600 hover:underline truncate max-w-[200px]">
                  {paymentLink.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Account Name
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="e.g. Smith Roofing Ltd"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">The name on your bank account</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Bank Name
          </label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. Barclays"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Account Number
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 12345678"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sort Code
          </label>
          <input
            type="text"
            value={sortCode}
            onChange={(e) => setSortCode(e.target.value)}
            placeholder="e.g. 00-00-00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Payment Link <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          value={paymentLink}
          onChange={(e) => setPaymentLink(e.target.value)}
          placeholder="e.g. https://pay.stripe.com/… or PayPal.me/…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
        />
        <p className="text-xs text-slate-400 mt-1">Stripe, PayPal, GoCardless or any direct pay link - shown as a clickable button on invoices</p>
      </div>

      {message && (
        <p className={`text-sm font-medium ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Payment Details'}
        </button>
      </div>
    </form>
  );
}
