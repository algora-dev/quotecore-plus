// Supplier definition registry. Adding a supplier demo:
//   1. Copy burton-roofing.ts -> <slug>.ts, change values + catalog.
//   2. Import it here and add to SUPPLIER_DEFS.
// Route: /supplier-pricing-tool/<slug> (default route = DEFAULT_SUPPLIER_SLAG).
// The tool components never change - everything renders from the def.

import { BURTON_ROOFING } from './burton-roofing';
import { VERTEX_CLADDING } from './vertex-cladding';
import { OAKLINE_FLOORING } from './oakline-flooring';
import { APEX_ROOFING } from './apex-roofing';
import type { SupplierProduct } from '../types';
import type { Trade } from '../tradeConfig';

/** Theme palette that drives the scoped CSS remap in the tool shell. */
export interface SupplierTheme {
  primary: string;
  primaryHover: string;
  accent: string;
  accentHover: string;
  border: string;
  borderHover: string;
  washAlpha: number;
  glowAlpha: number;
}

export interface SupplierDefinition {
  slug: string;
  /** which trade this instance serves - drives the flow model
   *  (roofing = groups + placeholder components, cladding/flooring =
   *  parent areas). Defaults to roofing when omitted. */
  trade?: Trade;
  name: string;
  tagline: string;
  /** demo instance - shows "(demo)" labelling so nobody mistakes it for a
   *  real company. All current suppliers in this tool are demos. */
  demo?: boolean;
  currency: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  brandColor: string;
  theme: SupplierTheme;
  poweredBy: boolean;
  discountPct: number;
  tradeRequiresLogin: boolean;
  features: {
    login: boolean;
    adminPanel: boolean;
    quoteCoreConnect: boolean;
    convertToQuote: boolean;
    emailCapture: boolean;
  };
  products: SupplierProduct[];
  /** external endpoint overrides - defaults are same-origin relative paths.
   *  Set absolute URLs (e.g. https://www.quote-core.com/...) when the tool
   *  is embedded on another domain (T3 Labs port). */
  urls?: {
    signup?: string;
    draftsApi?: string;
    enquiryApi?: string;
  };
}

export const SUPPLIER_DEFS: SupplierDefinition[] = [
  APEX_ROOFING as unknown as SupplierDefinition,
  BURTON_ROOFING as unknown as SupplierDefinition,
  VERTEX_CLADDING as unknown as SupplierDefinition,
  OAKLINE_FLOORING as unknown as SupplierDefinition,
];

export const DEFAULT_SUPPLIER_SLUG = 'burton-roofing';

export function getSupplierDef(slug: string | undefined | null): SupplierDefinition {
  return SUPPLIER_DEFS.find(d => d.slug === slug) ?? SUPPLIER_DEFS.find(d => d.slug === DEFAULT_SUPPLIER_SLUG)!;
}

export function supplierExists(slug: string): boolean {
  return SUPPLIER_DEFS.some(d => d.slug === slug);
}
