"use client";

import { CustomerQuoteRouteState } from '@/app/components/quote-entry/CustomerQuoteRouteState';

/** Load/render failure only. Existing editor save/send contracts stay intact.
 * The pinned Next 16.2 exposes unstable_retry to re-fetch server content. reset
 * alone only re-renders cached contents. The plain-link fallback in RouteState
 * works without version-specific APIs. Neither path saves or recreates lines.
 */
export default function CustomerQuoteError({ unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
}) {
  return <CustomerQuoteRouteState failed retry={unstable_retry} />;
}
