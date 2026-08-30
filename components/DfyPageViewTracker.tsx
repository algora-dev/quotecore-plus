'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Fires a single dfy_page_view GA event when the Done-For-You page mounts,
 * preserving attribution params (utm_*) where present.
 */
export default function DfyPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    params.forEach((value, key) => {
      if (key.startsWith('utm_')) utm[key] = value;
    });
    window.gtag('event', 'dfy_page_view', {
      page_path: pathname,
      ...utm,
    });
  }, [pathname]);

  return null;
}
