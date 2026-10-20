"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getConsent } from "@/lib/consent";
import { trackAnalyticsOnly, trackConversion, type ConversionType } from "@/lib/analytics";

const STORAGE_KEY = "qc_attribution_v2";
const LEGACY_STORAGE_KEY = "qc_attribution_v1";
const COOKIE_KEY = "qc_attribution_v2";
const SESSION_KEY = "qc_attribution_session_v1";
const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SECONDS = Math.floor(ATTRIBUTION_TTL_MS / 1000);
const MAX_PATH_LENGTH = 400;
const MAX_PARAM_LENGTH = 100;
const TRACKED_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"] as const;

type TrackedParam = (typeof TRACKED_PARAMS)[number];

export interface AttributionRecord extends Record<string, string | null> {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ref: string | null;
  landing_page: string;
  first_page_seen: string;
  first_referrer_host: string | null;
  first_touch_at: string;
  expires_at: string;
}

function isExpired(record: Partial<AttributionRecord> | null): boolean {
  if (!record?.expires_at) return false; // legacy records are migrated with a fresh TTL
  const expires = Date.parse(record.expires_at);
  return !Number.isFinite(expires) || expires <= Date.now();
}

function storageGet(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function siteFamily(hostname: string): string {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (host === "quote-core.com" || host.endsWith(".quote-core.com")) return "quote-core.com";
  if (host === "quote-core.co.nz" || host.endsWith(".quote-core.co.nz")) return "quote-core.co.nz";
  return host;
}

function cookieDomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  if (host === "quote-core.com" || host.endsWith(".quote-core.com")) return ".quote-core.com";
  return null;
}

function readCookie(): AttributionRecord | null {
  if (typeof document === "undefined") return null;
  const prefix = `${COOKIE_KEY}=`;
  const raw = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(prefix));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(prefix.length))) as AttributionRecord;
    return isExpired(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function writeCookie(record: AttributionRecord): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = cookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(record))}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}${domainPart}`;
}

function safeParse(raw: string | null): AttributionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AttributionRecord;
    return isExpired(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function externalReferrer(): { host: string | null; source: Record<string, string> } {
  if (typeof document === "undefined" || !document.referrer || typeof window === "undefined") {
    return { host: null, source: {} };
  }
  try {
    const ref = new URL(document.referrer);
    const host = ref.hostname.replace(/^www\./, "").toLowerCase();
    const current = window.location.hostname.replace(/^www\./, "").toLowerCase();
    if (siteFamily(host) === siteFamily(current)) return { host: null, source: {} };
    if (host.includes("google.")) return { host, source: { utm_source: "google", utm_medium: "organic" } };
    if (host.includes("bing.")) return { host, source: { utm_source: "bing", utm_medium: "organic" } };
    if (host.includes("linkedin.")) return { host, source: { utm_source: "linkedin", utm_medium: "social" } };
    if (host === "t.co" || host.includes("twitter.") || host.includes("x.com")) return { host, source: { utm_source: "x", utm_medium: "social" } };
    if (host.includes("instagram.")) return { host, source: { utm_source: "instagram", utm_medium: "social" } };
    if (host.includes("facebook.") || host.includes("fb.com")) return { host, source: { utm_source: "facebook", utm_medium: "social" } };
    if (host.includes("tiktok.")) return { host, source: { utm_source: "tiktok", utm_medium: "social" } };
    if (host.includes("youtube.") || host.includes("youtu.be")) return { host, source: { utm_source: "youtube", utm_medium: "social" } };
    if (host.includes("reddit.")) return { host, source: { utm_source: "reddit", utm_medium: "social" } };
    return { host, source: { utm_source: host, utm_medium: "referral" } };
  } catch {
    return { host: null, source: {} };
  }
}

function buildAttribution(): AttributionRecord {
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname + window.location.search;
  const now = new Date();
  const referrer = externalReferrer();

  const attribution: AttributionRecord = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    ref: null,
    landing_page: path.slice(0, MAX_PATH_LENGTH),
    first_page_seen: path.slice(0, MAX_PATH_LENGTH),
    first_referrer_host: referrer.host?.slice(0, 255) ?? null,
    first_touch_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ATTRIBUTION_TTL_MS).toISOString(),
  };

  let hasTrackedParam = false;
  for (const key of TRACKED_PARAMS) {
    const value = params.get(key);
    if (value) {
      attribution[key] = value.slice(0, MAX_PARAM_LENGTH);
      hasTrackedParam = true;
    }
  }

  if (!hasTrackedParam) {
    for (const [key, value] of Object.entries(referrer.source)) {
      if (!attribution[key as TrackedParam]) attribution[key as TrackedParam] = value.slice(0, MAX_PARAM_LENGTH);
    }
  }

  return attribution;
}

function persist(record: AttributionRecord): AttributionRecord {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* best effort */ }
  writeCookie(record);
  return record;
}

function migrateLegacy(): AttributionRecord | null {
  try {
    const legacy = JSON.parse(storageGet(window.localStorage, LEGACY_STORAGE_KEY) || "null") as Partial<AttributionRecord> | null;
    if (!legacy || typeof legacy !== "object") return null;
    const now = new Date();
    const path = (typeof legacy.landing_page === "string" ? legacy.landing_page : window.location.pathname + window.location.search).slice(0, MAX_PATH_LENGTH);
    const record: AttributionRecord = {
      utm_source: legacy.utm_source ?? null,
      utm_medium: legacy.utm_medium ?? null,
      utm_campaign: legacy.utm_campaign ?? null,
      utm_content: legacy.utm_content ?? null,
      utm_term: legacy.utm_term ?? null,
      ref: legacy.ref ?? null,
      landing_page: path,
      first_page_seen: (typeof legacy.first_page_seen === "string" ? legacy.first_page_seen : path).slice(0, MAX_PATH_LENGTH),
      first_referrer_host: null,
      first_touch_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ATTRIBUTION_TTL_MS).toISOString(),
    };
    return persist(record);
  } catch {
    return null;
  }
}

export function captureAttribution(): AttributionRecord | null {
  if (typeof window === "undefined") return null;

  // Treat persisted marketing attribution as analytics storage: do not create
  // or migrate it until the visitor has granted analytics consent.
  if (getConsent()?.analytics !== true) return null;

  const cookie = readCookie();
  if (cookie) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cookie)); } catch { /* best effort */ }
    return cookie;
  }

  const local = safeParse(storageGet(window.localStorage, STORAGE_KEY));
  if (local) {
    writeCookie(local);
    return local;
  }

  const migrated = migrateLegacy();
  if (migrated) return migrated;

  return persist(buildAttribution());
}

export function getAttribution(): AttributionRecord | null {
  if (typeof window === "undefined") return null;
  if (getConsent()?.analytics !== true) return null;
  return readCookie() || safeParse(storageGet(window.localStorage, STORAGE_KEY)) || captureAttribution();
}

function recordSessionTouch(): void {
  if (typeof window === "undefined" || getConsent()?.analytics !== true) return;
  const params = new URLSearchParams(window.location.search);
  const referrer = externalReferrer();
  const hasTrackedParam = TRACKED_PARAMS.some((key) => params.has(key));
  if (!hasTrackedParam && !referrer.host) return;
  const record: Record<string, string | null> = {
    page: (window.location.pathname + window.location.search).slice(0, MAX_PATH_LENGTH),
    referrer_host: referrer.host,
    touched_at: new Date().toISOString(),
  };
  for (const key of TRACKED_PARAMS) record[key] = params.get(key)?.slice(0, MAX_PARAM_LENGTH) ?? referrer.source[key] ?? null;
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(record)); } catch { /* best effort */ }
}

function classifyDestination(url: URL): ConversionType | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const currentHost = window.location.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (host === "calendly.com" || host.endsWith(".calendly.com")) return "book_call";
  if (path === "/done-for-you-setup" || path === "/done-for-you") return "done_for_you";
  if (path === "/pricing") return "pricing";
  if ((path === "/demo" || host === "demo.quote-core.com") && currentHost !== "demo.quote-core.com") return "demo";
  if (path === "/signup" || path.startsWith("/signup/")) return "create_account";
  // Only count the acquisition handoff into the paid app, not every internal
  // navigation after the visitor is already using app.quote-core.com.
  if (host === "app.quote-core.com" && currentHost !== "app.quote-core.com") return "open_app";
  return null;
}


function shouldDecorateDestination(url: URL): boolean {
  const destination = url.hostname.replace(/^www\./, "").toLowerCase();
  const current = window.location.hostname.replace(/^www\./, "").toLowerCase();
  if (destination === "calendly.com" || destination.endsWith(".calendly.com")) return true;
  // The NZ marketing site hands users to the .com demo/app. Cookies cannot
  // cross that TLD boundary, so preserve first-touch UTMs in the URL.
  if (current === "quote-core.co.nz" && (destination === "quote-core.com" || destination.endsWith(".quote-core.com"))) return true;
  return false;
}

function decorateDestinationWithAttribution(url: URL, anchor: HTMLAnchorElement): URL {
  if (!shouldDecorateDestination(url) || getConsent()?.analytics !== true) return url;
  const attribution = getAttribution();
  if (!attribution) return url;

  let changed = false;
  for (const key of TRACKED_PARAMS) {
    const value = attribution[key];
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
      changed = true;
    }
  }
  if (changed) anchor.href = url.toString();
  return url;
}

function trackAnchorConversion(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return;
  let url: URL;
  try { url = new URL(anchor.href, window.location.href); } catch { return; }
  url = decorateDestinationWithAttribution(url, anchor);
  const conversionType = classifyDestination(url);

  const locationNode = anchor.closest("[data-analytics-location]") as HTMLElement | null;
  const surfaceNode = anchor.closest("[data-analytics-surface]") as HTMLElement | null;
  const label = (anchor.textContent || anchor.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const location = locationNode?.dataset.analyticsLocation?.slice(0, 120) || "unspecified";
  const surfaceLocation = surfaceNode?.dataset.analyticsLocation?.slice(0, 120) || location;

  if (surfaceNode) {
    trackAnalyticsOnly("conversion_surface_click", {
      source_path: window.location.pathname,
      destination_host: url.hostname,
      destination_path: url.pathname,
      link_text: label || "unlabelled",
      location: surfaceLocation,
      surface: surfaceNode.dataset.analyticsSurface?.slice(0, 80) || "unspecified",
      action: anchor.dataset.analyticsAction?.slice(0, 80) || conversionType || "navigate",
    });
  }

  if (conversionType) {
    trackConversion(conversionType, {
      source_path: window.location.pathname,
      destination_host: url.hostname,
      destination_path: url.pathname,
      link_text: label || "unlabelled",
      location,
    });
  }
}

function observeConversionSurfaces(): () => void {
  if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") return () => {};

  const observed = new WeakSet<HTMLElement>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.35) continue;
      const node = entry.target as HTMLElement;
      if (node.dataset.analyticsViewed === "true") { observer.unobserve(node); continue; }
      node.dataset.analyticsViewed = "true";
      trackAnalyticsOnly("conversion_surface_view", {
        source_path: window.location.pathname,
        location: node.dataset.analyticsLocation?.slice(0, 120) || "unspecified",
        surface: node.dataset.analyticsSurface?.slice(0, 80) || "unspecified",
      });
      observer.unobserve(node);
    }
  }, { threshold: [0.35] });

  const observeNode = (node: HTMLElement) => {
    if (!node.matches("[data-analytics-surface]") || node.dataset.analyticsViewed === "true" || observed.has(node)) return;
    observed.add(node);
    observer.observe(node);
  };
  const scan = (root: ParentNode) => {
    if (root instanceof HTMLElement) observeNode(root);
    root.querySelectorAll<HTMLElement>("[data-analytics-surface]").forEach(observeNode);
  };

  scan(document);
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) scan(node);
      });
    }
  });
  if (document.body) mutationObserver.observe(document.body, { childList: true, subtree: true });

  return () => {
    mutationObserver.disconnect();
    observer.disconnect();
  };
}

export default function AttributionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const capture = () => {
      captureAttribution();
      recordSessionTouch();
    };
    capture();
    window.addEventListener("qc:consent-updated", capture as EventListener);
    document.addEventListener("click", trackAnchorConversion, true);
    return () => {
      window.removeEventListener("qc:consent-updated", capture as EventListener);
      document.removeEventListener("click", trackAnchorConversion, true);
    };
  }, []);

  useEffect(() => {
    let stop = observeConversionSurfaces();
    const refresh = () => {
      stop();
      document.querySelectorAll<HTMLElement>("[data-analytics-surface]").forEach((node) => {
        delete node.dataset.analyticsViewed;
      });
      stop = observeConversionSurfaces();
    };
    window.addEventListener("qc:consent-updated", refresh as EventListener);
    return () => {
      stop();
      window.removeEventListener("qc:consent-updated", refresh as EventListener);
    };
  }, [pathname]);

  return null;
}
