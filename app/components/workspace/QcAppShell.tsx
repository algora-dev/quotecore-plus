'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { QcButton } from '../ui/v2/QcButton';
import { QcDialog } from '../ui/v2/QcDialog';
import { QcIcon } from '../ui/v2/QcIcon';
import { QcNavigation } from './QcNavigation';
import type { WorkspaceNavEntitlements } from './WorkspaceNav';
import { shellRoute, workspaceNavigation, type ShellMode } from './shell-config';
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
  const [preference, setPreference] = useState<ShellMode>('expanded');
  const [override, setOverride] = useState<{ path: string; mode: ShellMode } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const storageKey = `quotecore.shell.sidebar.${workspaceSlug}.${userId}`;
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setPreference(saved === 'rail' || saved === 'hidden' ? saved : 'expanded');
    } catch { setPreference('expanded'); }
  }, [storageKey]);
  useEffect(() => { setMobileOpen(false); setOverride(null); }, [pathname]);
  // A route-specific override expires on exit. Immersive pages do not overwrite
  // the user's normal navigation preference. Neither this nor resize refreshes data.
  const mode = override?.path === pathname ? override.mode :
    route.defaultMode === 'expanded' ? preference : route.defaultMode;
  function changeMode(next: ShellMode) {
    setOverride({ path: pathname, mode: next });
    if (route.defaultMode === 'expanded') {
      setPreference(next);
      try { window.localStorage.setItem(storageKey, next); } catch { /* Optional preference only. */ }
    }
  }
  const navigation = (rail: boolean, mobile: boolean) => <QcNavigation items={items} pathname={pathname}
    workspaceSlug={workspaceSlug} entitlements={entitlements} rail={rail} logout={logout}
    onNavigate={mobile ? () => setMobileOpen(false) : undefined}
    label={mobile ? 'Mobile workspace navigation' : 'Workspace navigation'} />;

  return <div data-qc-ui="v2" data-qc-shell-mode={mode} data-qc-width={route.width} className="qc-app-shell">
    <a className="qc-skip-link" href="#qc-main">Skip to workspace</a>
    <aside id="qc-sidebar" className="qc-sidebar" data-takeoff-chrome="sidebar" aria-label="Workspace sidebar">
      <div className="qc-sidebar-brand">
        <Link href={`/${workspaceSlug}`} prefetch={false} className="qc-brand" aria-label="QuoteCore Plus home">
          <img src="/logo.png" alt="QuoteCore Plus" /><span className="qc-brand-compact" aria-hidden="true">Q<span>+</span></span>
        </Link>
        <QcButton variant="ghost" className="qc-icon-button qc-sidebar-toggle" aria-label={mode === 'expanded' ? 'Collapse navigation' : 'Expand navigation'}
          title={mode === 'expanded' ? 'Collapse navigation' : 'Expand navigation'} aria-controls="qc-sidebar" aria-expanded={mode === 'expanded'}
          onClick={() => changeMode(mode === 'expanded' ? 'rail' : 'expanded')}><QcIcon name={mode === 'expanded' ? 'collapse' : 'expand'} /></QcButton>
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
          <QcButton className="qc-icon-button qc-desktop-menu" variant="ghost" title={mode === 'hidden' ? 'Show navigation' : 'Hide navigation for more space'}
            aria-label={mode === 'hidden' ? 'Show navigation' : 'Hide navigation for more space'} aria-controls="qc-sidebar" aria-expanded={mode !== 'hidden'}
            onClick={() => changeMode(mode === 'hidden' ? 'expanded' : 'hidden')}><QcIcon name={mode === 'hidden' ? 'expand' : 'focus'} /></QcButton>
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
