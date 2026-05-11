'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Tabbed wrapper for the Account section.
 *
 * The whole /account experience is a single client-rendered tab switcher.
 * Server-loaded data for every tab is fetched once at the parent page
 * (`page.tsx`) and passed in via props \u2014 switching between Profile / Company /
 * Security / Notifications / Billing / Support is a state change, not a route
 * change. This is the speed win Shaun asked for: no server round-trip on tab
 * navigation.
 *
 * Deep links still work via the `?tab=` URL parameter:
 *   - /account                   -> Profile (default)
 *   - /account?tab=company       -> Company
 *   - /account?tab=security      -> Security
 *   - /account?tab=notifications -> Notifications
 *   - /account?tab=billing       -> Billing
 *   - /account?tab=support       -> Support tickets
 *
 * Old routes (/account/company, /account/security, etc.) redirect to the new
 * tab URLs via small server-component shims in their existing folders.\n */

export type AccountTabKey =
  | 'profile'
  | 'company'
  | 'security'
  | 'notifications'
  | 'billing'
  | 'support';

const TABS: { key: AccountTabKey; label: string; icon: ReactNode }[] = [
  {
    key: 'profile',
    label: 'Account',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    key: 'company',
    label: 'Company',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
      </svg>
    ),
  },
  {
    key: 'security',
    label: 'Security',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0h-2m6-6V7a4 4 0 00-8 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0" />
      </svg>
    ),
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    key: 'support',
    label: 'Support',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

function readTabFromUrl(value: string | null): AccountTabKey {
  switch (value) {
    case 'company':
    case 'security':
    case 'notifications':
    case 'billing':
    case 'support':
      return value;
    case 'profile':
    default:
      return 'profile';
  }
}

interface AccountTabsProps {
  /** Pre-rendered server content for each tab. */
  panels: Record<AccountTabKey, ReactNode>;
}

export function AccountTabs({ panels }: AccountTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = readTabFromUrl(searchParams.get('tab'));
  const [active, setActive] = useState<AccountTabKey>(initial);

  // Keep state in sync with the URL when the user navigates back/forward or
  // when an external link sets `?tab=...`.
  useEffect(() => {
    const next = readTabFromUrl(searchParams.get('tab'));
    setActive((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const pickTab = useCallback(
    (key: AccountTabKey) => {
      setActive(key);
      // Replace state (no history entry per click) so the back button still
      // takes the user out of /account in a single press.
      const params = new URLSearchParams(searchParams);
      if (key === 'profile') params.delete('tab');
      else params.set('tab', key);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-6">
      <aside className="w-full md:w-56 lg:w-60 md:flex-shrink-0">
        <nav aria-label="Account sections" className="md:sticky md:top-6 md:self-start">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-2 md:mx-0 px-2 md:px-0 pb-2 md:pb-0">
            {TABS.map((tab) => {
              const isActive = active === tab.key;
              return (
                <li key={tab.key}>
                  <button
                    type="button"
                    onClick={() => pickTab(tab.key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap md:whitespace-normal text-left ${
                      isActive
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{panels[active]}</main>
    </div>
  );
}
