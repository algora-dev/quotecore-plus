/**
 * EntitlementBanner: top-of-shell strip surfacing subscription state.
 *
 * Renders ABOVE every workspace page when the company's subscription needs
 * the user's attention. Stays SILENT when subscription_status is healthy
 * (active, no failures). The whole component returns
 * null in that case, so layout impact is zero.
 *
 * Decisions are made on the SERVER (this is a server component). Banner
 * copy and severity derive from the entitlements snapshot:
 *
 *   - past_due:                     amber "payment failed; update card"
 *   - grace:                        amber "limited access; pay to restore"
 *   - pending_data_purge:           red "data will be removed in N days"
 *   - cancellation_pending:         slate "cancellation pending"
 *   - suspended | canceled:         red "subscription inactive"
 *   - disputed:                     purple "dispute open; support contact"
 *
 * The banner deliberately does NOT block the page. Reads remain available
 * during dunning; only mutations get refused. The point of the banner is
 * to drive the user to /account?tab=billing to recover before they hit a
 * RLS / feature-gate error mid-flow.
 *
 * Phase 1 keeps copy plain. Phase 2 may add per-feature CTAs (e.g.
 * "Reactivate to keep Material Orders") but those add complexity we don't
 * yet need.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CompanyEntitlements } from '@/app/lib/billing/entitlements';

export interface EntitlementBannerProps {
  entitlements: CompanyEntitlements;
  workspaceSlug: string;
}

interface Variant {
  tone: 'amber' | 'red' | 'slate' | 'purple';
  title: string;
  description: string;
  ctaLabel: string;
  /**
   * When true, the CTA renders in the app's standard button style
   * (black pill, text-sm font-medium) instead of the tone-coloured banner
   * button. Used for the storage-over-limit variant so its CTA matches
   * every other button in the app.
   */
  standardCta?: boolean;
}

function pickVariant(ent: CompanyEntitlements): Variant | null {
  const billingHref = 'View billing';

  // Storage-over-limit is independent of subscription status: a healthy,
  // active plan can still be "red" on storage. Surface it first - file
  // uploads are blocked until they free space or upgrade. (Non-file actions
  // keep working.)
  if (ent.isOverStorage) {
    return {
      tone: 'red',
      title: 'Storage limit reached.',
      description:
        'You’re over your storage limit, so new file uploads are paused. Delete files or quotes to free up space, or upgrade your plan to continue uploading.',
      ctaLabel: 'Manage storage',
      standardCta: true,
    };
  }

  // Admin override / comp grants full access even when the raw subscription
  // status is canceled (e.g. never-paid accounts we comp or override from
  // the admin panel). The effective plan is what counts - never show
  // dunning/inactive banners for those accounts.
  const overrideActive =
    !!ent.adminOverridePlanCode &&
    !!ent.adminOverrideUntil &&
    new Date(ent.adminOverrideUntil).getTime() > Date.now();
  const compActive = !!ent.compUntil && new Date(ent.compUntil).getTime() > Date.now();
  if ((overrideActive || compActive) && ent.subscriptionStatus !== 'suspended') {
    return null;
  }

  switch (ent.subscriptionStatus) {
    case 'past_due': {
      return {
        tone: 'amber',
        title: 'Payment failed.',
        description:
          'Your most recent payment didn\u2019t go through. Update your card to keep full access.',
        ctaLabel: 'Update payment',
      };
    }
    case 'grace': {
      return {
        tone: 'amber',
        title: 'Limited access.',
        description:
          'Your subscription is in a grace window. New quotes, emails and other paid features are paused until billing is resolved.',
        ctaLabel: billingHref,
      };
    }
    case 'pending_data_purge': {
      return {
        tone: 'red',
        title: 'Data removal pending.',
        description:
          'Your subscription has been unpaid for over 45 days. Download or pay to keep your files \u2014 they will be deleted in the next 30 days.',
        ctaLabel: 'Reactivate',
      };
    }
    case 'cancellation_pending': {
      return {
        tone: 'slate',
        title: 'Cancellation pending.',
        description:
          'Your subscription is scheduled to cancel. You can change your mind in the billing portal.',
        ctaLabel: 'Manage subscription',
      };
    }
    case 'suspended':
    case 'canceled': {
      return {
        tone: 'red',
        title:
          ent.subscriptionStatus === 'suspended'
            ? 'Account suspended.'
            : 'Subscription inactive.',
        description:
          'Read access is still available. Subscribe to resume creating quotes and sending emails.',
        ctaLabel: 'Choose a plan',
      };
    }
    case 'disputed': {
      return {
        tone: 'purple',
        title: 'Payment dispute open.',
        description:
          'A dispute has been opened on your recent payment. Please resolve via the support ticket we created.',
        ctaLabel: 'View billing',
      };
    }
    /* 'trialing' remains a valid legacy DB status (comped accounts only);
       no banner is shown for it - trials no longer exist for new signups. */
    case 'active':
    case 'trialing':
    default:
      return null;
  }
}

const TONE_CLASSES: Record<Variant['tone'], string> = {
  amber: 'border-amber-300 bg-amber-50 text-amber-900',
  red: 'border-red-300 bg-red-50 text-red-900',
  slate: 'border-slate-300 bg-slate-50 text-slate-800',
  purple: 'border-purple-300 bg-purple-50 text-purple-900',
};

const CTA_TONE_CLASSES: Record<Variant['tone'], string> = {
  amber: 'bg-amber-700 hover:bg-amber-800 text-white',
  red: 'bg-red-700 hover:bg-red-800 text-white',
  slate: 'bg-slate-700 hover:bg-slate-800 text-white',
  purple: 'bg-purple-700 hover:bg-purple-800 text-white',
};

export function EntitlementBanner({ entitlements, workspaceSlug }: EntitlementBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const variant = pickVariant(entitlements);
  if (!variant || dismissed) return null;

  return (
    <div className={`border-b ${TONE_CLASSES[variant.tone]}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-semibold">{variant.title}</span>{' '}
          <span className="opacity-90">{variant.description}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/${workspaceSlug}/account?tab=billing`}
            prefetch={false}
            className={
              variant.standardCta
                ? 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-white bg-black hover:bg-slate-800 transition-all'
                : `inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${CTA_TONE_CLASSES[variant.tone]}`
            }
          >
            {variant.ctaLabel}
          </Link>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm opacity-60 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
