"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Fires competitor_page_pricing_view once when the pricing section
 * scrolls into view (consent-aware via trackEvent).
 */
export default function PricingViewTracker({ slug }: { slug: string }) {
  const fired = useRef(false);

  useEffect(() => {
    const el = document.getElementById("pricing");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            trackEvent("competitor_page_pricing_view", { page: slug });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [slug]);

  return null;
}
