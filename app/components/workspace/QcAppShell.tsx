'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { QcButton } from '../ui/v2/QcButton';
import { QcDialog } from '../ui/v2/QcDialog';
import { QcIcon } from '../ui/v2/QcIcon';
import { QcNavigation } from './QcNavigation';
import type { WorkspaceNavEntitlements } from './WorkspaceNav';
import { shellRoute, workspaceNavigation } from './shell-config';
import { QcSidebarTab } from './QcSidebarTab';
import { nextSidebarMode, readSidebarPreference, resolveSidebarMode, type SidebarOverride, type SidebarPreference } from './sidebar-state';
import './qc-shell.css';

interface Props {
  workspaceSlug: string; userId: string; companyName: string;
  entitlements: WorkspaceNavEntitlements; isSupplier: boolean; assistantAvailable: boolean;
  children: ReactNode; notices: ReactNode; entitlementBanner: ReactNode;
  bell: ReactNode; inbox: ReactNode; help: ReactNode; logout: ReactNode; assistant: ReactNode;
}
/** C23. The server retains authentication, data loading and plan gates.
 * One stable children tree: navigation resizing must never remount a workspace.
 * This component stores only a sidebar preference, never quote/client data.
 */
export function QcAppShell({ workspaceSlug, userId, companyName, entitlements, isSupplier,
  assistantAvailable, children, notices, entitlementBanner, bell, inbox, help, logout, assistant }: Props) {
  const pathname = usePathname() ?? `/${workspaceSlug}`;
  const route = shellRoute(pathname, workspaceSlug);
  const items = workspaceNavigation(workspaceSlug, isSupplier, assistantAvailable);
  const [preference, setPreference] = useState<SidebarPreference>('expanded');
  const [override, setOverride] = useState<SidebarOverride | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const storageKey = `quotecore.shell.sidebar.${workspaceSlug}.${userId}`;
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setPreference(readSidebarPreference(saved));
    } catch { setPreference('expanded'); }
  }, [storageKey]);
  useEffect(() => { setMobileOpen(false); setOverride(null); }, [pathname]);
  // A route-specific override expires on exit. Immersive pages do not overwrite
  // the user's normal navigation preference. Neither this nor resize refreshes data.
  const mode = resolveSidebarMode(pathname, route.defaultMode, preference, override);
  const presentation = mode === 'rail' ? 'rail' : mode === 'hidden' && override?.path === pathname
    ? override.presentation : 'expanded';
  // React 18 does not type the inert attribute. Set the native attribute on the
  // existing node so hidden links leave both keyboard and assistive navigation.
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    if (mode === 'hidden' && sidebar.contains(document.activeElement)) {
      tabRef.current?.focus({ preventScroll: true });
    }
    sidebar.toggleAttribute('inert', mode === 'hidden');
  }, [mode]);
  function changeMode(next: SidebarPreference) {
    setOverride({ path: pathname, mode: next, presentation: mode === 'rail' ? 'rail' : 'expanded' });
    if (route.defaultMode === 'expanded') {
      setPreference(next);
      try { window.localStorage.setItem(storageKey, next); } catch { /* Optional preference only. */ }
    }
  }
  const navigation = (rail: boolean, mobile: boolean) => <QcNavigation items={items} pathname={pathname}
    workspaceSlug={workspaceSlug} entitlements={entitlements} rail={rail} logout={logout}
    onNavigate={mobile ? () => setMobileOpen(false) : undefined}
    label={mobile ? 'Mobile workspace navigation' : 'Workspace navigation'} />;

  return <div data-qc-ui="v2" data-qc-shell-mode={mode} data-qc-width={route.width} data-qc-sidebar-presentation={presentation} className="qc-app-shell">
    <a className="qc-skip-link" href="#qc-main">Skip to workspace</a>
    <QcSidebarTab ref={tabRef} expanded={mode !== 'hidden'} onToggle={() => changeMode(nextSidebarMode(mode))} />
    <aside ref={sidebarRef} id="qc-sidebar" className="qc-sidebar" data-takeoff-chrome="sidebar"
      aria-hidden={mode === 'hidden' ? true : undefined} aria-label="Workspace sidebar">
      <div className="qc-sidebar-brand">
        <Link href={`/${workspaceSlug}`} prefetch={false} className="qc-brand" aria-label="QuoteCore Plus home">
          <img src="/logo.png" alt="QuoteCore Plus" /><img src="/q-mark.png" alt="" aria-hidden="true" className="qc-brand-compact" />
        </Link>
      </div>
      <div className="qc-workspace-identity"><span>Workspace</span><strong title={companyName}>{companyName}</strong></div>
      {navigation(mode === 'rail', false)}
    </aside>
    <div className="qc-shell-body">
      <div className="qc-required-notices">{notices}</div>
      <header className="qc-topbar" data-takeoff-chrome="header">
        <div className="qc-topbar-context">
          <QcButton className="qc-icon-button qc-mobile-menu" variant="ghost" aria-label="Open navigation" aria-haspopup="dialog"
            onClick={() => setMobileOpen(true)}><QcIcon name="menu" /></QcButton>
          <span className="qc-topbar-title">{route.label}</span>
        </div>
        <div className="qc-shell-utilities">{bell}{inbox}{help}</div>
      </header>
      {entitlementBanner}
      <main id="qc-main" tabIndex={-1} className="qc-main">{children}</main>
    </div>
    <div data-takeoff-chrome="assistant">{assistant}</div>
    <QcDialog open={mobileOpen} onRequestClose={() => setMobileOpen(false)} title="Your workspace"
      description={companyName} className="qc-mobile-navigation-dialog"
      footer={<QcButton onClick={() => setMobileOpen(false)} variant="secondary">Close navigation</QcButton>}>
      <div className="qc-mobile-navigation-close"><QcButton variant="ghost" className="qc-icon-button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><QcIcon name="close" /></QcButton></div>
      {navigation(false, true)}
    </QcDialog>
  </div>;
}
