"use client";

import { useEffect } from "react";

const STORAGE_KEY = "qc_attribution_v1";
const TRACKED_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"];

function referrerFallback(): Record<string, string> {
  if (typeof document === "undefined" || !document.referrer) return {};
  try {
    const ref = new URL(document.referrer);
    const host = ref.hostname.replace(/^www\./, "");
    if (host === window.location.hostname.replace(/^www\./, "")) return {};
    if (host.includes("google.")) return { utm_source: "google", utm_medium: "organic" };
    if (host.includes("bing.")) return { utm_source: "bing", utm_medium: "organic" };
    if (host.includes("linkedin.")) return { utm_source: "linkedin", utm_medium: "social" };
    if (host === "t.co" || host.includes("twitter.") || host.includes("x.com")) return { utm_source: "x", utm_medium: "social" };
    if (host.includes("instagram.")) return { utm_source: "instagram", utm_medium: "social" };
    if (host.includes("facebook.") || host.includes("fb.com")) return { utm_source: "facebook", utm_medium: "social" };
    if (host.includes("tiktok.")) return { utm_source: "tiktok", utm_medium: "social" };
    if (host.includes("youtube.") || host.includes("youtu.be")) return { utm_source: "youtube", utm_medium: "social" };
    if (host.includes("reddit.")) return { utm_source: "reddit", utm_medium: "social" };
    return { utm_source: host, utm_medium: "referral" };
  } catch {
    return {};
  }
}

export function captureAttribution() {
  if (typeof window === "undefined") return null;

  // First-touch: do not overwrite existing session attribution
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch { /* continue */ }
  }

  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname + window.location.search;

  const attribution: Record<string, string | null> = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    ref: null,
    landing_page: path,
    first_page_seen: path,
  };

  let hasUtm = false;
  for (const key of TRACKED_PARAMS) {
    const val = params.get(key);
    if (val) { attribution[key] = val.slice(0, 500); hasUtm = true; }
  }

  if (!hasUtm) {
    const fallback = referrerFallback();
    for (const [k, v] of Object.entries(fallback)) {
      if (!attribution[k]) attribution[k] = v;
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  return attribution;
}

export function getAttribution() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : captureAttribution();
  } catch { return null; }
}

export default function AttributionTracker() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
