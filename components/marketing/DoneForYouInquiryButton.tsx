'use client';

import type { MouseEvent, ReactNode } from 'react';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { openDoneForYouInquiry } from '@/components/marketing/DoneForYouInquiryModal';
import { trackEvent } from '@/lib/analytics';

function ClipboardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5.5h6M9.5 3h5A1.5 1.5 0 0116 4.5V6H8V4.5A1.5 1.5 0 019.5 3zM7 5.5H5.75A1.75 1.75 0 004 7.25v11A1.75 1.75 0 005.75 20h12.5A1.75 1.75 0 0020 18.25v-11a1.75 1.75 0 00-1.75-1.75H17M8 10h8m-8 4h8" /></svg>;
}

export function DoneForYouInquiryButton({
  children = 'Inquire about Done For You',
  size = 'default',
  variant = 'primary',
  className = '',
  source = 'done-for-you-page',
  icon = <ClipboardIcon />,
}: {
  children?: ReactNode;
  size?: 'default' | 'large';
  variant?: 'primary' | 'glass' | 'ghost';
  className?: string;
  source?: string;
  icon?: ReactNode;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackEvent('dfy_inquiry_open', { source });
    if (openDoneForYouInquiry()) event.preventDefault();
  }

  return (
    <MarketingButton
      href="/done-for-you-setup?inquire=1"
      variant={variant}
      size={size}
      className={className}
      icon={icon}
      onClick={handleClick}
    >
      {children}
    </MarketingButton>
  );
}
