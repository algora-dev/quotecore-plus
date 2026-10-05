'use client';

import type { CSSProperties } from 'react';

/**
 * Marketing mount for the V5 pricing calculator (Dark Focus, scoped .qcp).
 * Client wrapper because PricingCalculator takes function props
 * (continueHref) that cannot cross the server/client boundary.
 *
 * Continue = sign up with this setup: buildSignupHref serialises the
 * calculator intent into the signup URL (plus localStorage via the
 * result actions) so the setup survives email verification and onboarding
 * and is paid for at the end of signup (paywall).
 *
 * Booking CTAs share the existing Calendly calendar (owner directive
 * 2026-10-05): both events 20 minutes, distinguished by utm_content.
 */
import { PricingCalculator, PREVIEW_CATALOG, buildSignupHref } from './calculator';

const CALENDLY = 'https://calendly.com/quote-core-info/15-minute-meeting';

/** Sticky BlogHeader clearance for the marketing mount (px). */
const SHELL_STYLE = { '--qcp-header-offset': '80px' } as CSSProperties;

export function MarketingCalculator({ notice }: { notice?: string } = {}) {
  return (
    <div style={SHELL_STYLE}>
      <PricingCalculator
      catalog={PREVIEW_CATALOG}
      variant="page"
      notice={notice}
      continueHref={(intent) => buildSignupHref('/signup?utm_source=pricing', intent)}
      resultActions={{
        trade: 'roofing',
        setupRange: { currency: 'USD', minCents: 49900, maxCents: 149900 },
        links: {
          demo: '/demo',
          'free-tools': '/free-tools',
          'takeoff-roofing': '/free-roofing-takeoff-builder',
          'takeoff-cladding': '/free-cladding-takeoff',
          'takeoff-flooring': '/free-flooring-takeoff',
          'book-demo': `${CALENDLY}?utm_source=quotecore&utm_medium=pricing_page&utm_content=book_demo_15min`,
          'done-for-you': `${CALENDLY}?utm_source=quotecore&utm_medium=pricing_page&utm_content=done_for_you_consultation`,
        },
      }}
      />
    </div>
  );
}
