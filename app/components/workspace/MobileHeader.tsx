'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/app/components/auth/LogoutButton';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
}

interface MobileHeaderProps {
  workspaceSlug: string;
  navItems: NavItem[];
  /** Pre-rendered AlertBell from the layout (needs server data) */
  bell: ReactNode;
  /** Pre-rendered InboxLink from the layout */
  inbox: ReactNode;
  /** Pre-rendered HelpDrawerTrigger from the layout */
  help: ReactNode;
}

/**
 * Mobile header for QuoteCore+.
 *
 * Layout: [Q Logo]  [🔔]  [✉️]  [❓]  [☰]
 *
 * The hamburger opens a slide-down panel containing:
 * - Account, Logout
 * - Divider
 * - Quotes, Orders, Invoices, Resources
 *
 * Desktop (md+) renders nothing — the full header in the layout handles it.
 */
export function MobileHeader({ workspaceSlug, navItems, bell, inbox, help }: MobileHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close menu on route change (derived, not effect-based)
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  // Close menu on Escape + body scroll lock
  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setMenuOpen(prev => !prev);
  }, []);

  return (
    <div className="md:hidden">
      {/* Header bar: Logo | Bell | Inbox | Help | Hamburger */}
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <Link
          href={`/${workspaceSlug}`}
          prefetch={false}
          className="flex items-center"
          aria-label="QuoteCore+ home"
        >
          <img src="/logo.png" alt="QuoteCore" className="h-8" />
        </Link>

        <div className="flex items-center gap-1">
          {/* Bell — ensures 44px hit area */}
          <div className="inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
            {bell}
          </div>
          {/* Inbox */}
          <div className="inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
            {inbox}
          </div>
          {/* Help */}
          <div className="inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
            {help}
          </div>

          {/* Hamburger */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full transition-colors hover:bg-slate-100"
          >
            {menuOpen ? (
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Slide-down menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-nav-menu"
            className="fixed left-0 right-0 top-14 bg-white border-b border-slate-200 shadow-lg z-40 md:hidden safe-top"
          >
            <nav className="px-4 py-3 space-y-1">
              {/* Nav links first */}
              {navItems.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={`flex items-center rounded-lg px-3 py-3 text-sm font-medium min-h-[44px] transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Divider */}
              <div className="border-t border-slate-100 my-2" />

              {/* Account */}
              <Link
                href={`/${workspaceSlug}/account`}
                prefetch={false}
                className="flex items-center rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 min-h-[44px]"
              >
                Account
              </Link>

              {/* Logout */}
              <div className="flex items-center rounded-lg hover:bg-slate-50 min-h-[44px]">
                <LogoutButton className="flex-1 text-sm font-medium text-slate-700 bg-transparent border-0 px-3 py-3 hover:bg-transparent text-left" />
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
