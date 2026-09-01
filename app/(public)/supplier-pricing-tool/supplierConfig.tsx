// Supplier config layer: runtime-editable supplier branding, trade-pricing
// policy and catalog, per supplier definition (see ./supplierDefs).
// Defaults come from the registered def for the active slug; the demo admin
// panel writes overrides to localStorage (keyed per supplier) so the whole
// tool (header, catalog, pricing, output) reflects them live.
// Production/t3labs port: swap this module for static config reads - the
// consuming API (useSupplierConfig) stays identical.

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupplierProduct } from './types';
import type { SupplierTheme } from './supplierDefs';
import { getSupplierDef, DEFAULT_SUPPLIER_SLUG } from './supplierDefs';

export type { SupplierTheme };

export interface SupplierFeatures {
  /** trade-customer login (Google/email/magic link) + trade pricing gate */
  login: boolean;
  /** supplier admin panel at /admin */
  adminPanel: boolean;
  /** "Continue in QuoteCore+" draft-quote handoff (powered-by only) */
  quoteCoreConnect: boolean;
  /** convert output to customer quote via the quote generator */
  convertToQuote: boolean;
  /** email-capture modal at the output (lead capture for the supplier) */
  emailCapture: boolean;
}

export interface SupplierConfig {
  slug: string;
  name: string;
  tagline: string;
  currency: string;
  /** supplier logo URL (null = monogram placeholder) */
  logoUrl: string | null;
  /** darker logo variant for the brand-coloured header (falls back to logoUrl) */
  logoDarkUrl: string | null;
  /** supplier brand colour - drives output page accents/borders */
  brandColor: string;
  /** scoped theme palette - drives the tool shell CSS remap */
  theme: SupplierTheme;
  /** Powered by QuoteCore+ vs white-label */
  poweredBy: boolean;
  /** blanket trade discount % off baseline prices */
  discountPct: number;
  /** trade pricing only shown to logged-in users */
  tradeRequiresLogin: boolean;
  /** feature blocks - flipping one off never breaks the others */
  features: SupplierFeatures;
  /** external endpoint overrides - defaults are same-origin relative paths.
   *  Set absolute URLs (e.g. https://www.quote-core.com/...) when the tool
   *  is embedded on another domain (T3 Labs port). */
  urls?: {
    signup?: string;
    draftsApi?: string;
    enquiryApi?: string;
  };
  products: SupplierProduct[];
}

/** Resolved tool URLs - def overrides fall back to same-origin defaults. */
export function toolUrls(cfg: SupplierConfig) {
  return {
    signup: cfg.urls?.signup ?? '/signup',
    draftsApi: cfg.urls?.draftsApi ?? '/api/free-tools/drafts',
    enquiryApi: cfg.urls?.enquiryApi ?? '/api/free-tools/supplier-enquiry',
  };
}

export function defaultConfig(slug: string = DEFAULT_SUPPLIER_SLUG): SupplierConfig {
  return getSupplierDef(slug);
}

export function configStorageKey(slug: string): string {
  return `qc-spt-config-v3-${slug}`;
}

export function readStoredConfig(slug: string = DEFAULT_SUPPLIER_SLUG): SupplierConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(configStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupplierConfig>;
    const base = defaultConfig(slug);
    return {
      ...base,
      ...parsed,
      // merge feature flags so older stored configs pick up new flags
      features: { ...base.features, ...(parsed.features ?? {}) },
      theme: { ...base.theme, ...(parsed.theme ?? {}) },
      products: Array.isArray(parsed.products) && parsed.products.length > 0
        ? parsed.products
        : base.products,
    };
  } catch {
    return null;
  }
}

export function writeStoredConfig(cfg: SupplierConfig) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(configStorageKey(cfg.slug), JSON.stringify(cfg));
    // same-tab live update for every mounted consumer
    window.dispatchEvent(new CustomEvent('qc-spt-config-changed'));
  } catch { /* ignore quota errors */ }
}

export function resetStoredConfig(slug: string = DEFAULT_SUPPLIER_SLUG) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(configStorageKey(slug));
    window.dispatchEvent(new CustomEvent('qc-spt-config-changed'));
  } catch { /* ignore */ }
}

/** Captured leads (email-capture modal). Demo-grade storage: localStorage,
 *  keyed per supplier, surfaced in the admin panel. Production moves these
 *  to the supplier DB. */
const leadsKey = (slug: string) => `qc-spt-${slug}-leads-v1`;

export interface CapturedLead {
  email: string;
  name: string;
  capturedAt: string;
}

export function readLeads(slug: string = DEFAULT_SUPPLIER_SLUG): CapturedLead[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(leadsKey(slug));
    return raw ? (JSON.parse(raw) as CapturedLead[]) : [];
  } catch {
    return [];
  }
}

export function addLead(lead: Omit<CapturedLead, 'capturedAt'>, slug: string = DEFAULT_SUPPLIER_SLUG) {
  if (typeof window === 'undefined') return;
  try {
    const leads = readLeads(slug);
    if (leads.some(l => l.email.toLowerCase() === lead.email.toLowerCase())) return;
    leads.unshift({ ...lead, capturedAt: new Date().toISOString() });
    window.localStorage.setItem(leadsKey(slug), JSON.stringify(leads));
    window.dispatchEvent(new CustomEvent('qc-spt-leads-changed'));
  } catch { /* ignore */ }
}

/** Active supplier context: set once per page (shell) so every component
 *  below it shares the same slug, base path and live config state. */
interface SupplierConfigContextValue {
  slug: string;
  /** route base for this supplier instance, e.g. /supplier-pricing-tool */
  basePath: string;
  config: SupplierConfig;
  ready: boolean;
}

const SupplierConfigContext = createContext<SupplierConfigContextValue | null>(null);

export function SupplierConfigProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const basePath = slug === DEFAULT_SUPPLIER_SLUG
    ? '/supplier-pricing-tool'
    : `/supplier-pricing-tool/${slug}`;
  const [config, setConfig] = useState<SupplierConfig>(() => defaultConfig(slug));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setConfig(readStoredConfig(slug) ?? defaultConfig(slug));
    load();
    setReady(true);
    window.addEventListener('qc-spt-config-changed', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('qc-spt-config-changed', load);
      window.removeEventListener('storage', load);
    };
  }, [slug]);

  return (
    <SupplierConfigContext.Provider value={{ slug, basePath, config, ready }}>
      {children}
    </SupplierConfigContext.Provider>
  );
}

/** Live supplier config hook. Inside a SupplierConfigProvider (normal tool
 *  pages) it returns that supplier's config; standalone consumers fall back
 *  to the default supplier. */
export function useSupplierConfig(): SupplierConfigContextValue {
  const ctx = useContext(SupplierConfigContext);
  const [fallbackConfig, setFallbackConfig] = useState<SupplierConfig>(defaultConfig);
  const [fallbackReady, setFallbackReady] = useState(false);

  useEffect(() => {
    if (ctx) return;
    const load = () => setFallbackConfig(readStoredConfig() ?? defaultConfig());
    load();
    setFallbackReady(true);
    window.addEventListener('qc-spt-config-changed', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('qc-spt-config-changed', load);
      window.removeEventListener('storage', load);
    };
  }, [ctx]);

  if (ctx) return ctx;
  return { slug: DEFAULT_SUPPLIER_SLUG, basePath: '/supplier-pricing-tool', config: fallbackConfig, ready: fallbackReady };
}

/** Trade price for a product under a config (blanket discount off baseline). */
export function tradeUnitPrice(p: SupplierProduct, cfg: SupplierConfig): number {
  return Math.round(p.unitPrice * (1 - (cfg.discountPct || 0) / 100) * 100) / 100;
}
