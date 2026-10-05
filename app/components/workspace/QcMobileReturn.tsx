import Link from 'next/link';
import { QcIcon } from '../ui/v2/QcIcon';
import { ownsWorkspaceExit, workspaceReturn } from './workspace-return';

/** C65. Mobile fallback only. One stable page tree; no history, refresh or effects.
 * A page's explicit .qc-page-back takes precedence via the scoped shell CSS.
 */
export function QcMobileReturn({ pathname, workspaceSlug }: { pathname: string; workspaceSlug: string }) {
  const target = workspaceReturn(pathname, workspaceSlug);
  if (!target || ownsWorkspaceExit(pathname, workspaceSlug)) return null;
  return <nav className="qc-mobile-return" aria-label="Return navigation" data-qc-component="C65">
    <Link href={target.href} prefetch={false}><QcIcon name="back" />Back to {target.label}</Link>
  </nav>;
}
