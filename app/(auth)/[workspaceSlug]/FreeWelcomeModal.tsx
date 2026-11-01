'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { updateDefaultMeasurementSystem } from './account/actions';

/**
 * Welcome modal for freshly provisioned FREE workspaces (owner decision
 * 2026-11-01). /auth/callback lands the user on /{slug}?welcome=1 after
 * auto-provisioning. One-tap measurement system pick so their first quote
 * comes out in the right units, plus pointers to Account Settings (company
 * name, branding, password, 2FA). Closing strips the query param.
 */

type MeasurementSystem = 'metric' | 'imperial_ft' | 'imperial_rs';

const OPTIONS: { value: MeasurementSystem; label: string; hint: string }[] = [
  { value: 'metric', label: 'Square metres', hint: 'm2, metric' },
  { value: 'imperial_ft', label: 'Square feet', hint: 'sq ft, feet + inches' },
  { value: 'imperial_rs', label: 'Roofing squares', hint: 'US roofing, 10 x 10 ft' },
];

export function FreeWelcomeModal({ workspaceSlug }: { workspaceSlug: string }) {
  const open = useSearchParams().get('welcome') === '1';
  const router = useRouter();
  const [picked, setPicked] = useState<MeasurementSystem | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function close() {
    const params = new URLSearchParams(window.location.search);
    params.delete('welcome');
    const qs = params.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  function pick(value: MeasurementSystem) {
    setPicked(value);
    startTransition(async () => {
      try {
        await updateDefaultMeasurementSystem(value);
        setSaved(true);
      } catch {
        setSaved(false);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">Welcome to your free workspace</h2>
        <p className="mt-2 text-sm text-slate-600">
          Everything is unlocked and free to use. One quick question so your first quote comes out right:
        </p>

        <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Measurement system
        </p>
        <div className="grid gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={pending}
              onClick={() => pick(option.value)}
              className={`flex items-center justify-between rounded-full border px-4 py-3 text-left text-sm transition-colors disabled:opacity-60 ${
                picked === option.value
                  ? 'border-orange-200 bg-orange-50/60 shadow-[0_0_8px_rgba(255,107,53,0.08)]'
                  : 'border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200'
              }`}
            >
              <span className="font-medium text-slate-900">{option.label}</span>
              <span className="text-xs text-slate-500">{option.hint}</span>
            </button>
          ))}
        </div>

        {saved && (
          <p className="mt-3 text-xs text-emerald-700">Saved. Change it any time in Account Settings.</p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:shadow-[0_0_18px_rgba(255,107,53,0.32)] transition-shadow"
          >
            Start quoting
          </button>
          <Link
            href={`/${workspaceSlug}/account`}
            onClick={close}
            className="rounded-full border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:border-slate-400 transition-colors"
          >
            Set up my workspace
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Company name, branding, password and 2FA all live in Account Settings.
        </p>
      </div>
    </div>
  );
}
