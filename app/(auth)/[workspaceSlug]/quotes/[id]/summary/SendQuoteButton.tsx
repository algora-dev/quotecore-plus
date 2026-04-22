'use client';
import { useState } from 'react';
import { generateAcceptanceToken } from '../../actions';

interface Props {
  quoteId: string;
  existingToken: string | null;
  hasCustomerQuote: boolean;
}

export function SendQuoteButton({ quoteId, existingToken, hasCustomerQuote }: Props) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(existingToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!hasCustomerQuote) return null;

  const acceptanceUrl = token
    ? `${window.location.origin}/accept/${token}`
    : null;

  async function handleOpen() {
    setOpen(true);
    if (!token) {
      setLoading(true);
      try {
        const newToken = await generateAcceptanceToken(quoteId);
        setToken(newToken);
      } catch (err) {
        console.error('Failed to generate acceptance token:', err);
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleCopy() {
    if (!acceptanceUrl) return;
    try {
      await navigator.clipboard.writeText(acceptanceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = acceptanceUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        Send Quote
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Send Quote to Customer</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500">
                Generating acceptance link...
              </div>
            ) : acceptanceUrl ? (
              <>
                <p className="text-sm text-slate-600">
                  Paste this URL into a message or email to the intended customer. When they open it, they&apos;ll see your customer quote and can accept or decline it.
                </p>

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    readOnly
                    value={acceptanceUrl}
                    className="flex-1 text-sm text-slate-700 bg-transparent border-none outline-none truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                    }`}
                  >
                    {copied ? '✓ Copied!' : 'Copy URL'}
                  </button>
                </div>

                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-700">
                    <strong>Note:</strong> This link allows anyone with it to view your customer quote and accept or decline it. Only share it with the intended customer.
                  </p>
                </div>

                {token !== existingToken && (
                  <p className="text-xs text-slate-500">
                    Quote status has been updated to &quot;Sent&quot;.
                  </p>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-red-500">
                Failed to generate link. Please try again.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
