'use client';

import type { MouseEvent, ReactNode } from 'react';
import { MarketingButton } from './MarketingButton';

/**
 * Free Workspace CTA. Opens Gavin's signup flow at /signup (owner decision
 * 2026-11-01: signup flow stays on the development implementation; the
 * external handoff modal is not used).
 */
export function FreeWorkspaceButton({
  children = 'Create my free workspace',
  variant = 'primary',
  size = 'default',
  className = '',
  icon,
  onClick,
}: {
  children?: ReactNode;
  variant?: 'primary' | 'glass' | 'ghost';
  size?: 'default' | 'large';
  className?: string;
  icon?: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <MarketingButton
      href="/signup"
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
