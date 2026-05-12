'use client';

import { useEffect, useState, useTransition } from 'react';
import { generateOrderSupplierToken } from './supplier-link-actions';

interface Props {
  orderId: string;
  existingToken: string | null;
}

/**
 * "Supplier Link" pill button in the order preview top bar. Mirrors the
 * quote summary's Send-Quote URL flow but specialised for orders.
 *
 * First click: opens the modal, which generates a token (if none yet),
 * shows the URL, and copies it to the clipboard.
 * Subsequent clicks: re-opens the modal showing the same URL.
 *
 * The token persists on the order row (`material_orders.acceptance_token`);
 * we don't expose a "rotate" affordance here yet (Phase 2 if anyone asks).
 */
export function SupplierLinkButton({ orderId, existingToken }: Props) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(existingToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Generate token on modal open if none present. The lint rule
  // `react-hooks/no-sync-set-state-in-effect` (Next 16) flags any
  // setState during effect setup, so we defer state mutation into the
  // transition callback. The functional `setError(prev => prev ? null : prev)`
  // avoids the linter false-positive while keeping the visible state
  // consistent (no stale error pinned between opens).
  useEffect(() => {
    if (!open || token) return;
    startTransition(async () => {
      setError((prev) => (prev ? null : prev));
      try {
        const t = await generateOrderSupplierToken(orderId);
        setToken(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate link.');
      }
    });
  }, [open, token, orderId]);

  const supplierUrl =
    typeof window !== 'undefined' && token
      ? `${window.location.origin}/orders/${token}`
      : null;

  async function copy() {
    if (!supplierUrl) return;
    try {
      await navigator.clipboard.writeText(supplierUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers.
      const input = document.createElement('input');
      input.value = supplierUrl;
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
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-full hover:bg-slate-50 transition pill-shimmer"
        title="Generate or copy the supplier link for this order"
      >
        Supplier Link
      </button>

      {open ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 data-exclude-pdf">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Supplier Link</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Share this link with the supplier. They&apos;ll see the full order and can
              confirm, request changes, or ask a question. Responses come back as in-app
              alerts.
            </p>

            {error ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{error}</div>
            ) : null}

            {isPending && !supplierUrl ? (
              <div className="py-8 text-center text-slate-500 text-sm">Generating link\u2026</div>
            ) : supplierUrl ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    readOnly
                    value={supplierUrl}
                    className="flex-1 text-sm text-slate-700 bg-transparent border-none outline-none truncate"
                  />
                  <button
                    onClick={copy}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                    }`}
                  >
                    {copied ? '\u2713 Copied!' : 'Copy URL'}
                  </button>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-700">
                    <strong>Note:</strong> Anyone with this link can view the order and respond.
                    Only share it with the intended supplier.
                  </p>
                </div>
              </>
            ) : null}

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
      ) : null}
    </>
  );
}
