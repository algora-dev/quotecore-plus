"use client";

import { trackEvent } from "@/lib/analytics";
import { FreeWorkspaceButton } from "@/components/marketing/FreeWorkspaceButton";
import { MarketingButton } from "@/components/marketing/MarketingButton";

/** Client CTAs for competitor comparison pages with consent-aware tracking. */
export function TrackedCta({
  slug,
  location,
  href,
  label,
  variant = "primary",
  freeWorkspace = false,
}: {
  slug: string;
  location: string;
  href: string;
  label: string;
  variant?: "primary" | "accent" | "ghost";
  freeWorkspace?: boolean;
}) {
  const track = () => trackEvent("competitor_page_cta_click", { page: slug, location, target: freeWorkspace ? "free_workspace_modal" : href });
  if (freeWorkspace) {
    return <FreeWorkspaceButton variant={variant === "ghost" ? "glass" : "primary"} size="large" onClick={track}>{label}</FreeWorkspaceButton>;
  }
  return (
    <MarketingButton href={href} variant={variant === "primary" || variant === "accent" ? "primary" : "glass"} size="large" onClick={track}>
      {label}
    </MarketingButton>
  );
}
