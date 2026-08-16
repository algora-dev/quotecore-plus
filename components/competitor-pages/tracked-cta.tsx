"use client";

import { trackEvent } from "@/lib/analytics";

/**
 * Client CTAs for competitor comparison pages.
 * Wraps clicks with consent-aware conversion tracking
 * (competitor_page_cta_click events).
 */

export function TrackedCta({
  slug,
  location,
  href,
  label,
  variant = "primary",
}: {
  slug: string;
  location: string;
  href: string;
  label: string;
  variant?: "primary" | "accent" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex min-h-12 items-center justify-center rounded-full bg-black px-8 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
      : variant === "accent"
        ? "inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF6B35] px-8 py-3 text-base font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
        : "inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-8 py-3 text-base font-semibold text-zinc-900 transition-colors hover:border-zinc-400";
  return (
    <a
      href={href}
      className={cls}
      onClick={() =>
        trackEvent("competitor_page_cta_click", {
          page: slug,
          location,
          target: href,
        })
      }
    >
      {label}
    </a>
  );
}
