'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Vertical navigation for the /account section.
 *
 * Layout contract:
 *   - Sidebar is sticky (the SHELL is sticky; this component renders inside that
 *     sticky container in account/layout.tsx). It does not scroll independently
 *     of the page on desktop.
 *   - On mobile (<768px), the parent layout collapses the sidebar to a horizontal
 *     scroll strip; we use the same NAV_ITEMS list and rely on Tailwind classes
 *     in the parent for the responsive transformation.
 *   - The "Team" item is rendered but disabled with a tooltip until multi-user
 *     support ships. Implemented as a div, not a Link, so it's actually
 *     un-clickable rather than visually disabled but still routable.
 */

export type AccountNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** True when the item is rendered but not clickable (e.g. "Team — coming soon"). */
  disabled?: boolean;
  /** Tooltip shown on hover when disabled. */
  disabledTitle?: string;
};

function buildNavItems(slug: string): AccountNavItem[] {
  // Each icon is an inline SVG so we don't pull in an icon library for 6 glyphs.
  // Stroke-width 2 + size 18 keeps them visually balanced with the text labels.
  const cls = 'w-[18px] h-[18px] flex-shrink-0';
  return [
    {
      href: `/${slug}/account`,
      label: 'Account',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      href: `/${slug}/account/company`,
      label: 'Company',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
        </svg>
      ),
    },
    {
      href: `/${slug}/account/security`,
      label: 'Security',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0h-2m6-6V7a4 4 0 00-8 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      href: `/${slug}/account/notifications`,
      label: 'Notifications',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
      ),
    },
    {
      href: `/${slug}/account/billing`,
      label: 'Billing',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
      ),
    },
    {
      // Disabled link — still rendered so users see what's coming.
      href: '#',
      label: 'Team',
      disabled: true,
      disabledTitle: 'Coming soon',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 110-8 4 4 0 010 8zm6 4a3 3 0 100-6 3 3 0 000 6zM5 14a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      ),
    },
  ];
}

export function AccountSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const items = buildNavItems(slug);

  return (
    <nav aria-label="Account sections" className="md:sticky md:top-6 md:self-start">
      {/* Mobile: horizontal scroll strip. Desktop: vertical column. */}
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-2 md:mx-0 px-2 md:px-0 pb-2 md:pb-0">
        {items.map((item) => {
          // Active match: exact path, OR the item is the "Account" landing page
          // and we're on /account itself (no sub-segment).
          const isActive = pathname === item.href;
          const baseClass =
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap md:whitespace-normal';

          if (item.disabled) {
            return (
              <li key={item.label}>
                <div
                  title={item.disabledTitle}
                  aria-disabled="true"
                  className={`${baseClass} text-slate-400 cursor-not-allowed select-none`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
                    soon
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`${baseClass} ${
                  isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
