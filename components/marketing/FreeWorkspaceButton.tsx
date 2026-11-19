'use client';

import type { MouseEvent, ReactNode } from 'react';
import { MarketingButton } from './MarketingButton';

/**
 * Free Workspace CTA (owner reroute 2026-11-19). By default this now opens
 * the /free-trial "See how it works" page in the SAME browser tab (owner
 * 2026-11-19: same-tab navigation applies to every retargeted instance).
 * The only intentional direct signup entry is the /free-trial page's own
 * bottom CTA (`direct`), which forwards the ?ref tag it received so signup
 * attribution + per-tool welcome survive, and keeps the legacy new-tab
 * behaviour so the marketing page stays open.
 */
export function FreeWorkspaceButton({
  children = 'See how it works',
  variant = 'primary',
  size = 'default',
  className = '',
  icon,
  onClick,
  direct = false,
  refTag,
  newTab,
}: {
  children?: ReactNode;
  variant?: 'primary' | 'glass' | 'ghost';
  size?: 'default' | 'large';
  className?: string;
  icon?: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Keep the legacy direct-to-/signup link. Only the /free-trial page uses this. */
  direct?: boolean;
  /** Source tag appended as ?ref= for attribution (kept through the /free-trial hop). */
  refTag?: string;
  /** Tab behaviour override. Default: /free-trial CTAs same tab, direct signup new tab. */
  newTab?: boolean;
}) {
  const query = refTag ? `?ref=${encodeURIComponent(refTag)}` : '';
  const href = direct ? `/signup${query}` : `/free-trial${query}`;
  const opensNewTab = newTab ?? direct;
  return (
    <MarketingButton
      href={href}
      target={opensNewTab ? '_blank' : undefined}
      variant={variant}
      size={size}
      className={className}
      icon={icon}
      onClick={onClick}
    >
      {children}
    </MarketingButton>
  );
}
