'use client';

import type { MouseEvent, ReactNode } from 'react';
import { MarketingButton } from './MarketingButton';

/**
 * Free Workspace CTA. Opens the signup flow at /signup in a new browser tab
 * (owner decisions 2026-11-01 development signup flow, 2026-11-02 new tab so
 * the marketing page stays open).
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
      target="_blank"
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
