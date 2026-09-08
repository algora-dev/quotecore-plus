// Demo supplier definition: Roofline Canterbury (cladding) - the cladding
// half of the dual-trade Roofline demo. Weatherboard (Colorsteel) covering
// + the 8 cladding flashings. Roofing half lives in roofline-roofing.ts.

import type { SupplierProduct } from '../types';

export const ROOFLINE_CLADDING = {
  slug: 'roofline-cladding',
  trade: 'cladding' as const,
  name: 'Roofline Canterbury',
  demo: true,
  tagline: 'Roofing & Cladding Manufacturers - Christchurch',
  currency: '$', // NZD
  logoUrl: '/supplier-logos/roofline-canterbury.png',
  logoDarkUrl: '/supplier-logos/roofline-canterbury.png',
  brandColor: '#C8102E', // Roofline red (output accents)
  headerColor: '#111111', // black header
  logoWhiteBox: true,
  demoDisclaimer: false,
  guideLineColor: '#C8102E', // red indicative lines in guide diagrams
  guideLineColorName: 'red',
  theme: {
    primary: '#111111', // Roofline black
    primaryHover: '#2A2A2A',
    accent: '#C8102E',
    accentHover: '#A50D26',
    border: '#E3A5AD',
    borderHover: '#D67F8A',
    washAlpha: 0.05,
    glowAlpha: 0.4,
  },
  poweredBy: true,
  discountPct: 12,
  bucketExamples: ['Weatherboard', 'Corrugate', 'Roofdeck'],
  tradeRequiresLogin: true,
  features: {
    login: true,
    adminPanel: true,
    quoteCoreConnect: true,
    convertToQuote: true,
    emailCapture: true,
    pricingMode: true,
  },
  products: [
    // ---- Wall covering (area) ----
    { id: 'rf-wb-cs', name: 'Weatherboard (Colorsteel) 0.40g', code: 'RF-WB-CS', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 38.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 34.0, priceEditable: true, suggested: true },
    // Same material as the roofing versions (roofline-roofing.ts) - wall-
    // mount labour is higher. 0.40g gauge only per Shaun 2026-09-08.
    { id: 'rf-cgw-040', name: 'Corrugate (Wall) 0.40g', code: 'RF-CGW-040', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Corrugate', unitPrice: 22.5, packSize: null, defaultWastePct: 12, defaultLabourRate: 8.5, priceEditable: true, suggested: true },
    { id: 'rf-rdw-040', name: 'Roofdeck (Wall) 0.40g', code: 'RF-RDW-040', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Roofdeck', unitPrice: 23.5, packSize: null, defaultWastePct: 10, defaultLabourRate: 9.0, priceEditable: true, suggested: true },

    // ---- Cladding flashings (lineal, Colorsteel, +0.2m per entry) ----
    { id: 'rf-fl-int-corner', name: 'Internal Corner Flashing', code: 'FLS-RF-IC', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 14.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 18.0, priceEditable: true },
    { id: 'rf-fl-ext-corner', name: 'External Corner Flashing', code: 'FLS-RF-EC', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 15.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 20.0, priceEditable: true },
    { id: 'rf-fl-head', name: 'Window/Door Head Flashing', code: 'FLS-RF-HD', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 22.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 26.0, priceEditable: true, suggested: true },
    { id: 'rf-fl-jamb', name: 'Window/Door Jamb Flashing', code: 'FLS-RF-JB', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 16.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 22.0, priceEditable: true },
    { id: 'rf-fl-sill', name: 'Window Sill Flashing', code: 'FLS-RF-SL', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 19.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 24.0, priceEditable: true },
    { id: 'rf-fl-base', name: 'Base Flashing', code: 'FLS-RF-BS', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 13.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 18.0, priceEditable: true },
    { id: 'rf-fl-soffit', name: 'Soffit Flashing', code: 'FLS-RF-SF', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 15.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 20.0, priceEditable: true },
    { id: 'rf-fl-soaker', name: 'Soaker Flashing', code: 'FLS-RF-SK', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 12.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 16.0, priceEditable: true },
  ] as SupplierProduct[],
} as const;
