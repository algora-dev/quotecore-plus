import { getConsent } from "@/lib/consent";

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    lintrk?: (action: string, data?: object) => void;
  }
}

export type AnalyticsValue = string | number | boolean;
export type AnalyticsParams = Record<string, AnalyticsValue>;

export type ConversionType =
  | "demo"
  | "book_call"
  | "done_for_you"
  | "pricing"
  | "create_account"
  | "open_app";


/** GA-only interaction telemetry for CRO surfaces. Unlike trackEvent, this
 * deliberately does not forward to Meta or LinkedIn conversion APIs. */
export function trackAnalyticsOnly(eventName: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;
  if (getConsent()?.analytics !== true) return;
  if (window.gtag) window.gtag("event", eventName, params ?? {});
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;

  // GA4. Consent Mode decides whether storage is available; events can be
  // emitted safely before/after the preference UI resolves.
  if (window.gtag) {
    window.gtag("event", eventName, params ?? {});
  }

  // Meta Pixel - retain the existing standard-event mappings and add the
  // Phase 1 canonical conversion event so old reports do not break.
  if (window.fbq) {
    if (eventName === "signup_complete") {
      window.fbq("track", "Lead", params);
    } else if (eventName === "book_call_click") {
      window.fbq("track", "Schedule", params);
    } else if (eventName === "free_trial_click" || eventName === "create_account_click") {
      window.fbq("track", "InitiateCheckout", params);
    }
  }

  // Keep the new canonical funnel event GA-only. Several existing buttons
  // already emit page-specific Meta/LinkedIn events; forwarding both would
  // double-count the same click in ad platforms.
  if (eventName !== "conversion_click" && window.lintrk) {
    window.lintrk("track", { conversion_id: eventName });
  }
}

/**
 * Canonical Phase 1 conversion event. Existing page-specific events remain in
 * place, while this gives analytics one consistent event to build funnels on.
 */
export function trackConversion(
  conversionType: ConversionType,
  params?: Omit<AnalyticsParams, "conversion_type">,
) {
  // Canonical acquisition funnels should only contain consented sessions so
  // their source/path properties can be interpreted consistently.
  if (getConsent()?.analytics !== true) return;
  trackEvent("conversion_click", {
    conversion_type: conversionType,
    ...(params ?? {}),
  });
}
