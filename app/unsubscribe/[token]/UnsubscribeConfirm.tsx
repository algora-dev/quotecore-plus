'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmMarketingUnsubscribe } from './actions';

/**
 * Client confirm card for /unsubscribe/[token]. The write only happens on
 * button click (POST server action) - GET never unsubscribes, so email
 * scanners and prefetchers cannot trigger it (same pattern as /m/[token]/stop).
 */
export function UnsubscribeConfirm({
  token,
  valid,
  confirmed,
  hadError,
}: {
  token: string;
  valid: boolean;
  confirmed: boolean;
  hadError: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (confirmed) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">You&apos;ve been unsubscribed</h1>
        <p className="mt-3 text-sm text-slate-600">
          You won&apos;t receive any more marketing emails from us. If you ever want to hear
          from us again, just sign back in to QuoteCore+ or reply to any email.
        </p>
      </Shell>
    );
  }

  if (hadError || !valid) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">Link expired or invalid</h1>
        <p className="mt-3 text-sm text-slate-600">
          This unsubscribe link is no longer valid. If you keep receiving emails you don&apos;t
          want, reply with &quot;stop&quot; to any of them.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-slate-900">Confirm unsubscribe</h1>
      <p className="mt-3 text-sm text-slate-600">
        Click the button below to stop receiving marketing emails from QuoteCore+.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await confirmMarketingUnsubscribe(token);
            if (result.ok) {
              router.push('?confirmed=1');
            } else {
              setError('Something went wrong - please try again.');
            }
          });
        }}
        className="mt-5 w-full px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50"
      >
        {pending ? 'Unsubscribing...' : 'Yes, unsubscribe me'}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        {children}
        <p className="mt-6 text-[11px] text-slate-400">
          Sent via QuoteCore<span className="text-orange-500">+</span>
        </p>
      </div>
    </div>
  );
}
