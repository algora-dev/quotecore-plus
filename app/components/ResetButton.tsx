'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ResetResult =
  | { ok: true; cancelledFollowUps: number }
  | { ok: false; error: string };

interface Props {
  /** Server action that performs the reset for this specific entity id. */
  action: (id: string) => Promise<ResetResult>;
  /** The entity id to reset. */
  id: string;
  /** "Order" | "Invoice" | "Quote" — used in copy. */
  entityLabel: 'Order' | 'Invoice' | 'Quote';
  /** Where to send the user after a successful reset (defaults to refresh). */
  redirectTo?: string;
  /** Optional extra classes for the trigger button. */
  className?: string;
}

/**
 * "Reset" control for orders / invoices / quotes.
 *
 * Voids the current public link and rolls the item back to its pre-send state
 * so the user can remedy a request / dispute and re-send a fresh copy with a
 * brand-new URL. Because this is destructive (the old link dies and lifecycle
 * stamps are wiped), it always goes through a confirm modal.
 *
 * Tooltip copy (Shaun, locked 2026-06-10):
 *   "Reset if you want to start fresh and send a new <Entity> — Caution, all
 *    previous data and links will be void if you reset"
 */
export function ResetButton({ action, id, entityLabel, redirectTo, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lower = entityLabel.toLowerCase();
  const tooltip = `Reset if you want to start fresh and send a new ${entityLabel} - Caution, all previous data and links will be void if you reset`;

  async function doReset() {
    setPending(true);
    setError(null);
    try {
      const res = await action(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title={tooltip}
        className={
          className ??
          'px-4 py-2 text-sm font-medium border border-amber-300 bg-white text-amber-700 rounded-full hover:bg-amber-50 transition pill-shimmer'
        }
      >
        Reset
      </button>

      {open && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900">Reset this {lower}?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This starts the {lower} fresh so you can re-send a new one. The current
              public link will be <span className="font-medium text-slate-900">voided</span> and
              the {lower}&rsquo;s sent / read / response state is cleared. Any pending follow-ups
              are cancelled.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Caution: all previous data and links will be void once you reset.
            </p>

            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doReset}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(217,119,6,0.4)]"
              >
                {pending ? 'Resetting…' : `Reset ${entityLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
