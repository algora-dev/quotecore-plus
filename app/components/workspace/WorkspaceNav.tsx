"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Feature } from '@/app/lib/billing/features';
import { FEATURE_LABELS, FEATURE_MIN_PLAN } from '@/app/lib/billing/features';
import { UpgradeModal } from '@/app/components/UpgradeModal';

type NavKey = 'quotes' | 'invoices' | 'material-orders' | 'resources';

interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  copilot: string;
  /**
   * If the company's effective plan doesn't include this feature, render
   * the nav item with a lock affordance. Clicking still routes the user
   * through; the destination page is responsible for showing the upgrade
   * prompt. We deliberately don't disable the link so users can read
   * existing data and discover what they'd unlock by upgrading.
   */
  gatedBy?: Feature;
}

/**
 * Lightweight subset of CompanyEntitlements the nav cares about. Keeping
 * this narrow lets us avoid serialising the entire entitlements snapshot
 * across the server/client boundary.
 */
export interface WorkspaceNavEntitlements {
  features: Record<Feature, boolean>;
}

const makeNavItems = (slug: string): NavItem[] => {
  const base = `/${slug}`;
  return [
    { key: 'quotes', href: `${base}/quotes`, label: 'Quotes', copilot: 'nav-quotes' },
    { key: 'invoices', href: `${base}/invoices`, label: 'Invoices', copilot: 'nav-invoices' },
    {
      key: 'material-orders',
      href: `${base}/material-orders`,
      label: 'Orders',
      copilot: 'nav-orders',
      gatedBy: 'material_orders',
    },
    { key: 'resources', href: `${base}/resources`, label: 'Resources', copilot: 'nav-resources' },
  ];
};

export function WorkspaceNav({
  workspaceSlug,
  entitlements,
}: {
  workspaceSlug: string;
  entitlements: WorkspaceNavEntitlements;
}) {
  const pathname = usePathname();
  const items = makeNavItems(workspaceSlug);
  // We only ever surface ONE upgrade modal at a time; storing the gated
  // feature triggers it. null = no modal open.
  const [upgradeFor, setUpgradeFor] = useState<Feature | null>(null);

  return (
    <>
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {items.map((item) => {
          const isActive = pathname?.startsWith(`${item.href}`);
          const isGated = item.gatedBy ? !entitlements.features[item.gatedBy] : false;

          // Gated items render as a button (not a Link). Clicking opens
          // the upgrade modal; the destination page is never reached.
          // Per Shaun's spec: "greyed out, just not accessible at all".
          if (isGated && item.gatedBy) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setUpgradeFor(item.gatedBy!)}
                data-copilot={item.copilot}
                title={`${item.label} requires a higher plan`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200 ease-in-out text-slate-500 border-2 border-transparent hover:bg-slate-100 cursor-pointer"
              >
                {item.label}
                <svg
                  className="h-3.5 w-3.5 opacity-70"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-label="Locked: upgrade required"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 1a4 4 0 00-4 4v3H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 7V5a2 2 0 10-4 0v3h4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={false}
              data-copilot={item.copilot}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200 ease-in-out ${
                isActive
                  ? 'bg-black text-white border-2 border-black'
                  : 'text-slate-600 border-2 border-transparent pill-shimmer'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <UpgradeModal
        open={upgradeFor !== null}
        onClose={() => setUpgradeFor(null)}
        title={upgradeFor ? `${FEATURE_LABELS[upgradeFor]} requires a higher plan` : ''}
        description={
          upgradeFor
            ? `${FEATURE_LABELS[upgradeFor]} is available on the ${FEATURE_MIN_PLAN[upgradeFor]} plan or above. Upgrade your account to unlock it.`
            : ''
        }
        recommendedPlan={upgradeFor ? FEATURE_MIN_PLAN[upgradeFor] : undefined}
      />
    </>
  );
}
