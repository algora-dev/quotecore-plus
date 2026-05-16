/**
 * EntitlementBanner: top-of-shell strip surfacing subscription state.
 *
 * Renders ABOVE every workspace page when the company's subscription needs
 * the user's attention. Stays SILENT when subscription_status is healthy
 * (active, no failures, no trial nearing end). The whole component returns
 * null in that case, so layout impact is zero.
 *
 * Decisions are made on the SERVER (this is a server component). Banner
 * copy and severity derive from the entitlements snapshot:
 *
 *   - trialing + days_left <= 3:    soft amber "trial ending"
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

import Link from 'next/link';
import type { CompanyEntitlements } from '@/app/lib/billing/entitlements';

export interface EntitlementBannerProps {
  entitlements: CompanyEntitlements;
  workspaceSlug: string;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

interface Variant {
  tone: 'amber' | 'red' | 'slate' | 'purple';
  title: string;
  description: string;
  ctaLabel: string;
}

function pickVariant(ent: CompanyEntitlements): Variant | null {
  const billingHref = 'View billing';

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
    case 'trialing': {
      const left = daysUntil(ent.trialEndsAt);
      if (left !== null && left <= 3 && left >= 0) {
        return {
          tone: 'amber',
          title: left === 0 ? 'Trial ends today.' : `Trial ends in ${left} day${left === 1 ? '' : 's'}.`,
          description:
            'Pick a plan to keep your work, quotes and email sends after the trial ends.',
          ctaLabel: 'Upgrade',
        };
      }
      return null;
    }
    case 'active':
    case 'trialing' /* unreached when no countdown */:
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
  const variant = pickVariant(entitlements);
  if (!variant) return null;

  return (
    <div className={`border-b ${TONE_CLASSES[variant.tone]}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-semibold">{variant.title}</span>{' '}
          <span className="opacity-90">{variant.description}</span>
        </div>
        <Link
          href={`/${workspaceSlug}/account?tab=billing`}
          prefetch={false}
          className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold ${CTA_TONE_CLASSES[variant.tone]}`}
        >
          {variant.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
