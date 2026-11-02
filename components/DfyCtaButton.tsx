'use client';

import { MarketingButton } from "@/components/marketing/MarketingButton";
import { doneForYouCallHref } from "@/lib/booking";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/** Tracked CTA link for the Done For You page. */
export default function DfyCtaButton({
  event,
  label = "Book 25 minutes with Shaun",
  variant = "primary",
}: {
  event: string;
  label?: string;
  variant?: "primary" | "outline";
}) {
  return (
    <MarketingButton
      href={doneForYouCallHref}
      variant={variant === "primary" ? "primary" : "glass"}
      size="large"
      onClick={() => {
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
          window.gtag("event", event);
        }
      }}
    >
      {label}
    </MarketingButton>
  );
}
