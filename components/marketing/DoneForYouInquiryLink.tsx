'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { openDoneForYouInquiry } from '@/components/marketing/DoneForYouInquiryModal';
import { trackEvent } from '@/lib/analytics';

/** Style-neutral Done For You entry point with a safe page fallback. */
export function DoneForYouInquiryLink({
  children = 'Inquire about Done For You',
  className,
  source = 'done-for-you-link',
}: {
  children?: ReactNode;
  className?: string;
  source?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackEvent('dfy_inquiry_open', { source });
    if (openDoneForYouInquiry()) event.preventDefault();
  }
  return <Link href="/done-for-you-setup?inquire=1" prefetch={false} className={className} onClick={handleClick}>{children}</Link>;
}
