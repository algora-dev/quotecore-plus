'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { QcIcon } from '../ui/v2/QcIcon';
import type { WorkspaceNavEntitlements } from './WorkspaceNav';
import { navIsActive, type ShellNavItem } from './shell-config';

interface Props {
  items: ShellNavItem[]; pathname: string; workspaceSlug: string;
  entitlements: WorkspaceNavEntitlements; rail?: boolean;
  onNavigate?: () => void; logout: ReactNode; label: string;
}
export function QcNavigation({ items, pathname, workspaceSlug, entitlements, rail = false,
  onNavigate, logout, label }: Props) {
  return <nav aria-label={label} className="qc-shell-navigation">
    {(['work', 'library', 'utility'] as const).map(group => <div key={group} className={`qc-nav-group qc-nav-${group}`}>
      <p className="qc-nav-group-label">{group === 'work' ? 'Your work' : group === 'library' ? 'Set up & reuse' : 'Support & account'}</p>
      {items.filter(item => item.group === group).map(item => {
        const locked = item.gatedBy ? !entitlements.features[item.gatedBy] : false;
        return <Link key={item.key} href={item.href} prefetch={false} onClick={onNavigate}
          className="qc-nav-link" aria-current={navIsActive(item, pathname, workspaceSlug) ? 'page' : undefined}
          aria-label={rail ? `${item.label}${locked ? ' - higher plan required' : ''}` : undefined}
          title={rail || locked ? `${item.label}${locked ? ' - higher plan required' : ''}` : undefined}
          data-copilot={item.copilot} data-assistant-id={item.key === 'account' ? 'nav-account' : undefined}>
          <QcIcon name={item.icon} /><span className="qc-nav-label">{item.label}</span>
          {locked && <span className="qc-nav-lock"><QcIcon name="lock" /><span className="qc-sr-only">Higher plan required</span></span>}
        </Link>;
      })}
    </div>)}
    <div className="qc-shell-logout" title={rail ? 'Logout' : undefined}>{logout}</div>
  </nav>;
}
