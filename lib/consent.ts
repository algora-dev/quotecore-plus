export const CONSENT_KEY = "qc_cookie_consent";
export const CURRENCY_KEY = "qc_currency";
export const CONSENT_VERSION = "1.0";

const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface ConsentPrefs {
  strictlyNecessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

function cookieDomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  // Share consent across quote-core.com, app.quote-core.com and demo.quote-core.com.
  if (host === "quote-core.com" || host.endsWith(".quote-core.com")) return ".quote-core.com";
  // quote-core.co.nz is a separate registrable domain and must keep its own consent.
  return null;
}

function readConsentCookie(): ConsentPrefs | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CONSENT_KEY}=`;
  const raw = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(prefix));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(prefix.length))) as ConsentPrefs;
  } catch {
    return null;
  }
}

function writeConsentCookie(prefs: ConsentPrefs): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = cookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${CONSENT_KEY}=${encodeURIComponent(JSON.stringify(prefs))}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}${domainPart}`;
}

export function getConsent(): ConsentPrefs | null {
  if (typeof window === "undefined") return null;

  // Prefer the cookie because it follows visitors between quote-core.com,
  // app.quote-core.com and demo.quote-core.com. localStorage is retained as
  // a backwards-compatible fallback for existing marketing-site consent.
  const cookie = readConsentCookie();
  if (cookie) return cookie;

  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const prefs = JSON.parse(raw) as ConsentPrefs;
    writeConsentCookie(prefs); // one-time migration to cross-subdomain consent
    return prefs;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean, marketing: boolean): ConsentPrefs {
  const prefs: ConsentPrefs = {
    strictlyNecessary: true,
    analytics,
    marketing,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs)); } catch { /* best effort */ }
  writeConsentCookie(prefs);

  // Attribution waits for analytics consent before persisting first-touch data.
  // This event lets it capture the current landing source immediately after a
  // visitor makes a choice without requiring a reload.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("qc:consent-updated", { detail: prefs }));
  }
  return prefs;
}

export function hasConsented(): boolean {
  return getConsent() !== null;
}

export function getSavedCurrency(): "GBP" | "USD" | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(CURRENCY_KEY);
  return val === "GBP" || val === "USD" ? val : null;
}

export function saveCurrency(currency: "GBP" | "USD"): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(CURRENCY_KEY, currency);
  }
}
