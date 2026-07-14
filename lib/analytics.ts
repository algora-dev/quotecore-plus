/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    lintrk?: (action: string, data?: object) => void;
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number>
) {
  if (typeof window === "undefined") return;

  // GA4
  if (window.gtag) {
    window.gtag("event", eventName, params ?? {});
  }

  // Meta Pixel - map to standard events
  if (window.fbq) {
    if (eventName === "signup_complete") {
      window.fbq("track", "Lead", params);
    } else if (eventName === "book_call_click") {
      window.fbq("track", "Schedule", params);
    } else if (eventName === "free_trial_click" || eventName === "create_account_click") {
      window.fbq("track", "InitiateCheckout", params);
    }
  }

  // LinkedIn Insight - custom conversion
  if (window.lintrk) {
    window.lintrk("track", { conversion_id: eventName });
  }
}
