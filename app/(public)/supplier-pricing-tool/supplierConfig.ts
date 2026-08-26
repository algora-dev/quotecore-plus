// Supplier config layer (Phase 5 demo): runtime-editable supplier branding,
// trade-pricing policy and catalog. Defaults come from supplier.ts; the demo
// admin panel (/supplier-pricing-tool/admin) writes overrides to localStorage
// so the whole tool (header, catalog, pricing, output) reflects them live.
// Production will move this to server-side supplier config - the read API
// (useSupplierConfig) stays the same.

'use client';

import { useEffect, useState } from 'react';
import type { SupplierProduct } from './types';
import { DEMO_CATALOG, SUPPLIER } from './supplier';

export interface SupplierConfig {
  name: string;
  tagline: string;
  currency: string;
  /** Powered by QuoteCore+ vs white-label */
  poweredBy: boolean;
  /** blanket trade discount % off baseline prices */
  discountPct: number;
  /** trade pricing only shown to logged-in users */
  tradeRequiresLogin: boolean;
  products: SupplierProduct[];
}

export const CONFIG_STORAGE_KEY = 'qc-spt-supplier-config-v1';

export function defaultConfig(): SupplierConfig {
  return {
    name: SUPPLIER.name,
    tagline: SUPPLIER.tagline,
    currency: SUPPLIER.currency,
    poweredBy: SUPPLIER.mode === 'powered_by',
    discountPct: 12,
    tradeRequiresLogin: true,
    products: DEMO_CATALOG,
  };
}

export function readStoredConfig(): SupplierConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupplierConfig>;
    const base = defaultConfig();
    return {
      ...base,
      ...parsed,
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
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    // same-tab live update for every mounted consumer
    window.dispatchEvent(new CustomEvent('qc-spt-config-changed'));
  } catch { /* ignore quota errors */ }
}

export function resetStoredConfig() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('qc-spt-config-changed'));
  } catch { /* ignore */ }
}

/** Live supplier config hook - defaults until mounted, then localStorage
 *  overrides (kept in sync across components via a storage event). */
export function useSupplierConfig(): { config: SupplierConfig; ready: boolean } {
  const [config, setConfig] = useState<SupplierConfig>(defaultConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setConfig(readStoredConfig() ?? defaultConfig());
    load();
    setReady(true);
    window.addEventListener('qc-spt-config-changed', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('qc-spt-config-changed', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  return { config, ready };
}

/** Trade price for a product under a config (blanket discount off baseline). */
export function tradeUnitPrice(p: SupplierProduct, cfg: SupplierConfig): number {
  return Math.round(p.unitPrice * (1 - (cfg.discountPct || 0) / 100) * 100) / 100;
}
