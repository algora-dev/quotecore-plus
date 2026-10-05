'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QcIcon } from './ui/v2/QcIcon';
import { workspaceReturn } from './workspace/workspace-return';
import './ui/v2/qc.css';

/** Existing call sites remain valid. Prefer an explicit, origin-aware href where
 * one exists. A direct/bookmarked page otherwise returns to its workspace parent,
 * not an unrelated external history entry. No refresh or session history writes.
 */
export function BackButton({ href, label, className = '' }: { href?: string; label?: string; className?: string }) {
  const pathname = usePathname() ?? '';
  const slug = pathname.split('/').filter(Boolean)[0];
  const target = slug ? workspaceReturn(pathname, slug) : null;
  return <Link href={href ?? target?.href ?? '/'} prefetch={false} data-qc-ui="v2"
    className={`qc-button qc-page-back ${className}`} aria-label={label ?? `Back to ${target?.label ?? 'Home'}`}>
    <QcIcon name="back" />{label ?? `Back to ${target?.label ?? 'Home'}`}
  </Link>;
}
