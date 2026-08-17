'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

export const TRIAL_HREF = '/free-trial?utm_source=takeoff-demo&utm_medium=demo&utm_campaign=trial';

/** Trial CTA for the takeoff-demo page — fires the trial_click event. */
export function TrialCTA({ label = 'Start a free 14-day trial', className }: { label?: string; className?: string }) {
  return (
    <Link
      href={TRIAL_HREF}
      onClick={() => trackEvent('trial_click', { source: 'takeoff-demo' })}
      className={
        className ??
        'mt-6 inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]'
      }
    >
      {label}
    </Link>
  );
}
