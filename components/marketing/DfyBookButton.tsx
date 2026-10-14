'use client';

import { MarketingButton } from '@/components/marketing/MarketingButton';
import { doneForYouConfig } from '@/components/marketing/home/done-for-you-config';
import { trackEvent } from '@/lib/analytics';

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4.75 9.25h14.5M6.25 4.5h11.5A2.25 2.25 0 0120 6.75v11A2.25 2.25 0 0117.75 20H6.25A2.25 2.25 0 014 17.75v-11A2.25 2.25 0 016.25 4.5z" /></svg>;
}

/**
 * Done-For-You booking CTA. Books via the dedicated DFY calendar
 * (NEXT_PUBLIC_DFU_BOOKING_URL, never the product-demo calendar) and falls
 * back to /contact so the CTA is never dead. Opens in a new tab.
 */
export function DfyBookButton({ cta, label, size = 'default' }: {
  cta: 'hero' | 'pricing' | 'final';
  label: string;
  size?: 'default' | 'large';
}) {
  const href = doneForYouConfig.bookingHref || '/contact';
  return (
    <MarketingButton href={href} variant="primary" size={size} icon={<CalendarIcon />} onClick={() => trackEvent('dfy_cta_click', { cta })}>
      {label}
    </MarketingButton>
  );
}
