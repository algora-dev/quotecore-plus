// Demo-grade admin data layer for the supplier pricing tool: trade tiers,
// trade customers (email -> tier), team members, CTA settings, admin
// feature flags and tracking events. localStorage-backed per supplier with
// same-tab change events (same pattern as supplierConfig). Production swaps
// this module for API calls - the shapes stay identical.

import type { SupplierConfig } from './supplierConfig';

export interface TradeTier {
  id: string;
  name: string;
  discountPct: number;
}

export interface TradeCustomer {
  email: string;
  tierId: string | null;
  status: 'invited' | 'active';
  addedAt: string;
  lastLoginAt: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Editor';
  status: 'active' | 'invited';
}

export interface CtaSettings {
  enabled: boolean;
  discountPct: number;
  headline: string;
  body: string;
  buttonLabel: string;
}

/** Admin feature blocks - upsell toggles. All on = full-feature demo. */
export interface AdminFeatures {
  products: boolean;
  tradePricing: boolean;
  team: boolean;
  tracking: boolean;
  cta: boolean;
}

export interface AdminData {
  tiers: TradeTier[];
  customers: TradeCustomer[];
  team: TeamMember[];
  cta: CtaSettings;
  features: AdminFeatures;
}

/** Tracking events (quote created / signup captured). */
export interface QuoteEvent {
  type: 'quote';
  createdAt: string;
  email: string | null;
  itemCount: number;
  total: number;
  currency: string;
  /** productId -> quoted quantity (drives the product leaderboard) */
  productCounts: Record<string, number>;
}

export interface SignupEvent {
  type: 'signup';
  createdAt: string;
  email: string;
  name: string;
}

export type TrackingEvent = QuoteEvent | SignupEvent;

export const DEFAULT_CTA: CtaSettings = {
  enabled: true,
  discountPct: 5,
  headline: 'Get {pct}% off this job',
  body: 'Join the pricing list - we\'ll email your saving code plus a copy of this pricing.',
  buttonLabel: 'Send my {pct}% saving code',
};

function defaultTeam(supplierName: string): TeamMember[] {
  return [{ id: 'tm-1', name: 'Owner', email: `owner@${supplierName.toLowerCase().replace(/[^a-z]+/g, '')}.co.uk`, role: 'Owner', status: 'active' }];
}

export function defaultAdminData(cfg: SupplierConfig): AdminData {
  return {
    tiers: [
      { id: 't1', name: 'Trade Tier 1', discountPct: 5 },
      { id: 't2', name: 'Trade Tier 2', discountPct: Math.max(cfg.discountPct, 10) },
    ],
    customers: [],
    team: defaultTeam(cfg.name),
    cta: { ...DEFAULT_CTA },
    features: { products: true, tradePricing: true, team: true, tracking: true, cta: true },
  };
}

const key = (slug: string) => `qc-spt-${slug}-admin-v2`;
const eventsKey = (slug: string) => `qc-spt-${slug}-events-v1`;
export const adminAuthKey = (slug: string) => `qc-spt-${slug}-admin-auth`;

export function readAdminData(slug: string, cfg: SupplierConfig): AdminData {
  if (typeof window === 'undefined') return defaultAdminData(cfg);
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return defaultAdminData(cfg);
    const parsed = JSON.parse(raw) as Partial<AdminData>;
    const base = defaultAdminData(cfg);
    return {
      tiers: Array.isArray(parsed.tiers) && parsed.tiers.length > 0 ? parsed.tiers : base.tiers,
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      team: Array.isArray(parsed.team) && parsed.team.length > 0 ? parsed.team : base.team,
      cta: { ...base.cta, ...(parsed.cta ?? {}) },
      features: { ...base.features, ...(parsed.features ?? {}) },
    };
  } catch {
    return defaultAdminData(cfg);
  }
}

export function writeAdminData(slug: string, data: AdminData) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('qc-spt-admin-changed'));
  } catch { /* ignore */ }
}

export function resetAdminData(slug: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key(slug));
  window.dispatchEvent(new CustomEvent('qc-spt-admin-changed'));
}

// ---- events ----

export function readEvents(slug: string): TrackingEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(eventsKey(slug));
    return raw ? (JSON.parse(raw) as TrackingEvent[]) : [];
  } catch {
    return [];
  }
}

export function logEvent(slug: string, ev: TrackingEvent) {
  if (typeof window === 'undefined') return;
  try {
    const all = readEvents(slug);
    all.unshift(ev);
    // demo-grade cap so localStorage never balloons
    window.localStorage.setItem(eventsKey(slug), JSON.stringify(all.slice(0, 200)));
    window.dispatchEvent(new CustomEvent('qc-spt-events-changed'));
  } catch { /* ignore */ }
}

// ---- trade resolution ----

/** Effective trade discount for a (possibly anonymous) tool user:
 *  customer-tier discount when their email is on the list, otherwise the
 *  supplier's blanket discount. */
export function effectiveTrade(cfg: SupplierConfig, admin: AdminData, email?: string | null): { pct: number; label: string | null } {
  const customer = email ? admin.customers.find(c => c.email.toLowerCase() === email.toLowerCase()) : undefined;
  if (customer) {
    const tier = admin.tiers.find(t => t.id === customer.tierId);
    if (tier) return { pct: tier.discountPct, label: `${tier.name} (-${tier.discountPct}%)` };
  }
  return { pct: cfg.discountPct || 0, label: cfg.discountPct > 0 ? `trade pricing (-${cfg.discountPct}%)` : null };
}

/** Fill {pct} placeholders in CTA copy. */
export function ctaText(text: string, pct: number): string {
  return text.replace(/\{pct\}/g, String(pct));
}
