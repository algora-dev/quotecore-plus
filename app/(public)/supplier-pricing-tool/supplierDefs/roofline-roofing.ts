// Demo supplier definition: Roofline Canterbury (roofing) - the roofing
// half of the dual-trade Roofline demo (black/red brand from
// roofline.co.nz). Roofdeck + Corrugate profiles, flashings per profile,
// fascia/gutter/downpipes. Cladding half lives in roofline-cladding.ts.

import type { SupplierProduct } from '../types';

export const ROOFLINE_ROOFING = {
  slug: 'roofline-roofing',
  trade: 'roofing' as const,
  name: 'Roofline Canterbury',
  demo: true,
  tagline: 'Roofing & Cladding Manufacturers - Christchurch',
  currency: '$', // NZD
  logoUrl: '/supplier-logos/roofline-canterbury.png',
  logoDarkUrl: '/supplier-logos/roofline-canterbury.png',
  brandColor: '#C8102E', // Roofline red (output accents)
  headerColor: '#111111', // black header
  logoWhiteBox: true,
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
    // ---- Roof coverings (area) - profile families set compatibility ----
    { id: 'rf-rd-040', name: 'Roofdeck 0.40g', code: 'RF-RD-040', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['roofdeck'], family: 'Roofdeck', unitPrice: 23.5, packSize: null, defaultWastePct: 10, defaultLabourRate: 7.0, priceEditable: true, suggested: true },
    { id: 'rf-rd-055', name: 'Roofdeck 0.55g', code: 'RF-RD-055', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['roofdeck'], family: 'Roofdeck', unitPrice: 28.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 8.0, priceEditable: true },
    { id: 'rf-cg-040', name: 'Corrugate 0.40g', code: 'RF-CG-040', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['corrugate'], family: 'Corrugate', unitPrice: 22.5, packSize: null, defaultWastePct: 12, defaultLabourRate: 6.5, priceEditable: true, suggested: true },
    { id: 'rf-cg-055', name: 'Corrugate 0.55g', code: 'RF-CG-055', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['corrugate'], family: 'Corrugate', unitPrice: 27.5, packSize: null, defaultWastePct: 12, defaultLabourRate: 7.5, priceEditable: true },

    // ---- Underlays (area, all roofs) ----
    { id: 'rf-underlay-205', name: '205 Underlay', code: 'UND-RF-205', basis: 'area', groups: ['roofAreas'], component: 'underlay', roofTypes: ['all'], unitPrice: 5.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 5.0, priceEditable: true, suggested: true },
    { id: 'rf-underlay-407', name: '407 Covertek Underlay', code: 'UND-RF-407', basis: 'area', groups: ['roofAreas'], component: 'underlay', roofTypes: ['all'], unitPrice: 15.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 5.0, priceEditable: true },

    // ---- Screws / fixings (area, no labour) ----
    { id: 'rf-screws-65', name: 'Screws (Fixings) - 65mm', code: 'FIX-RF-65', basis: 'area', groups: ['roofAreas'], component: 'fixing', roofTypes: ['all'], unitPrice: 2.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 0, priceEditable: true, suggested: true },
    { id: 'rf-screws-50', name: 'Screws (Fixings) - 50mm', code: 'FIX-RF-50', basis: 'area', groups: ['roofAreas'], component: 'fixing', roofTypes: ['all'], unitPrice: 1.7, packSize: null, defaultWastePct: 10, defaultLabourRate: 0, priceEditable: true },

    // ---- Ridge (lineal, +0.25m per entry) ----
    { id: 'rf-ridge-rd', name: 'Ridge Flashing - Roofdeck', code: 'RDG-RF-RD', basis: 'lineal', groups: ['ridges'], component: 'ridge', roofTypes: ['roofdeck'], family: 'Roofdeck', unitPrice: 18.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 22.0, priceEditable: true, suggested: true },
    { id: 'rf-ridge-cg', name: 'Ridge Flashing - Corrugate', code: 'RDG-RF-CG', basis: 'lineal', groups: ['ridges'], component: 'ridge', roofTypes: ['corrugate'], family: 'Corrugate', unitPrice: 21.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 22.0, priceEditable: true, suggested: true },

    // ---- Hip (lineal, +0.25m per entry) ----
    { id: 'rf-hip-rd', name: 'Hip Flashing - Roofdeck', code: 'HIP-RF-RD', basis: 'lineal', groups: ['hips'], component: 'hip', roofTypes: ['roofdeck'], family: 'Roofdeck', unitPrice: 18.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 24.0, priceEditable: true, suggested: true },
    { id: 'rf-hip-cg', name: 'Hip Flashing - Corrugate', code: 'HIP-RF-CG', basis: 'lineal', groups: ['hips'], component: 'hip', roofTypes: ['corrugate'], family: 'Corrugate', unitPrice: 22.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 24.0, priceEditable: true, suggested: true },

    // ---- Valley (lineal, +0.25m per entry - one profile suits both systems) ----
    { id: 'rf-valley', name: 'Valley Flashing - Corrugate', code: 'VAL-RF-CG', basis: 'lineal', groups: ['valleys'], component: 'valley', roofTypes: ['roofdeck', 'corrugate'], unitPrice: 17.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 12.0, priceEditable: true, suggested: true },

    // ---- Barge (lineal, +0.25m per entry) ----
    { id: 'rf-barge-rd', name: 'Barge Flashing - Roofdeck', code: 'BRG-RF-RD', basis: 'lineal', groups: ['barges'], component: 'barge', roofTypes: ['roofdeck'], family: 'Roofdeck', unitPrice: 22.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 18.0, priceEditable: true, suggested: true },
    { id: 'rf-barge-cg', name: 'Barge Flashing - Corrugate', code: 'BRG-RF-CG', basis: 'lineal', groups: ['barges'], component: 'barge', roofTypes: ['corrugate'], family: 'Corrugate', unitPrice: 22.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.25, defaultLabourRate: 18.0, priceEditable: true, suggested: true },

    // ---- Fascia + spouting (lineal, +0.2m per entry) ----
    { id: 'rf-fascia-185', name: '185 Fascia', code: 'FAS-RF-185', basis: 'lineal', groups: ['spouting'], component: 'gutter', roofTypes: ['all'], unitPrice: 22.0, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 18.0, priceEditable: true, suggested: true },
    { id: 'rf-quad-gutter', name: 'Roofline Quad Gutter', code: 'GUT-RF-QUAD', basis: 'lineal', groups: ['spouting'], component: 'gutter', roofTypes: ['all'], unitPrice: 22.5, packSize: null, defaultWastePct: 0, defaultWasteMode: 'flat', defaultWasteFlat: 0.2, defaultLabourRate: 30.0, priceEditable: true, suggested: true },

    // ---- Downpipes (single 3m items, count) ----
    { id: 'rf-dp-80', name: '80mm Downpipe 3m', code: 'DWN-RF-80', basis: 'count', groups: ['downpipes'], component: 'downpipe', roofTypes: ['all'], unitPrice: 60.0, packSize: null, defaultWastePct: 0, defaultLabourRate: 24.0, priceEditable: true, suggested: true },
    { id: 'rf-dp-rect', name: '75x50 Rect Downpipe 3m', code: 'DWN-RF-7550', basis: 'count', groups: ['downpipes'], component: 'downpipe', roofTypes: ['all'], unitPrice: 70.0, packSize: null, defaultWastePct: 0, defaultLabourRate: 40.0, priceEditable: true },
  ] as SupplierProduct[],
} as const;
