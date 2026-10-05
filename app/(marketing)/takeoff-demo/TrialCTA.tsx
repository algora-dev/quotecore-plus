'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

export const TRIAL_HREF = '/pricing?utm_source=takeoff-demo&utm_medium=demo&utm_campaign=get-started';

/** Get-started CTA for the takeoff-demo page — fires the get_started_click event. */
export function TrialCTA({ label = 'Get started with QuoteCore+', className }: { label?: string; className?: string }) {
  return (
    <Link
      href={TRIAL_HREF}
      onClick={() => trackEvent('get_started_click', { source: 'takeoff-demo' })}
      className={
        className ??
        'mt-6 inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]'
      }
    >
      {label}
    </Link>
  );
}
