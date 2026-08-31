// Supplier definition: Burton Roofing - config #1, the original demo build.
// Everything Burton-specific lives here (brand, theme, pricing policy,
// catalog). Adding a new supplier demo = copy this file, change the values,
// register it in ./index.ts. No component changes required.

import type { SupplierProduct } from '../types';

export const BURTON_ROOFING = {
  slug: 'burton-roofing',
  name: 'Burton Roofing',
  tagline: 'The Roofing People',
  currency: '\u00A3', // GBP
  logoUrl: '/supplier-logos/burton-roofing.png',
  /** darker logo variant for use on the dark brand-coloured header */
  logoDarkUrl: '/supplier-logos/burton-roofing-dark.png',
  brandColor: '#012B39', // Burton teal
  theme: {
    primary: '#012B39',
    primaryHover: '#014055',
    accent: '#014E63',
    accentHover: '#013A4D',
    border: '#8FBAC4',
    borderHover: '#6BA7B4',
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
  },
  products: [
    // ---- Roof coverings (area) - picking one sets roof type + family ----
    { id: 'cupa-r18', name: 'CUPA R18 Natural Spanish Slate 500x250mm', code: 'SLT-CU-R18', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['slate'], family: 'CUPA Slate', unitPrice: 48.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 21.0, priceEditable: true, suggested: true },
    { id: 'cupa-heavy3', name: 'CUPA Heavy 3 Natural Spanish Slate 500x250mm', code: 'SLT-CU-H3', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['slate'], family: 'CUPA Slate', unitPrice: 52.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 21.0, priceEditable: true },
    { id: 'marley-edgemere', name: 'Marley Edgemere - Smooth Grey', code: 'TIL-MA-EDG', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['tile'], family: 'Marley Edgemere', unitPrice: 32.0, packSize: null, defaultWastePct: 7.5, defaultLabourRate: 14.0, priceEditable: true, suggested: true },
    { id: 'marley-ludlow', name: 'Marley Ludlow Plus - Greystone', code: 'TIL-MA-LUD', basis: 'area', groups: ['roofAreas'], component: 'covering', roofTypes: ['tile'], family: 'Marley Ludlow', unitPrice: 34.0, packSize: null, defaultWastePct: 7.5, defaultLabourRate: 14.0, priceEditable: true },

    // ---- Underlays (area, all roofs) ----
    { id: 'tyvek-supro', name: 'TYVEK Supro Felt 50m x 1.5m', code: 'UND-TY-SUP', basis: 'area', groups: ['roofAreas'], component: 'underlay', roofTypes: ['all'], unitPrice: 3.2, packSize: null, defaultWastePct: 10, defaultLabourRate: 6.0, priceEditable: true, suggested: true },
    { id: 'permavent-apex', name: 'Permavent Apex Air Permeable Membrane 1m x 50m', code: 'UND-PV-APX', basis: 'area', groups: ['roofAreas'], component: 'underlay', roofTypes: ['all'], unitPrice: 2.8, packSize: null, defaultWastePct: 10, defaultLabourRate: 6.0, priceEditable: true },

    // ---- Fixings (area, roof-type specific) ----
    { id: 'copper-slate-nails', name: 'Copper Slate Nails / Slate Fixings', code: 'FIX-CU-SLT', basis: 'area', groups: ['roofAreas'], component: 'fixing', roofTypes: ['slate'], family: 'CUPA Slate', unitPrice: 1.2, packSize: null, defaultWastePct: 0, defaultLabourRate: 0, priceEditable: true, suggested: true },
    { id: 'tile-nails-clips', name: 'Tile Nails + Clips 45 x 3.35mm', code: 'FIX-TL-45', basis: 'area', groups: ['roofAreas'], component: 'fixing', roofTypes: ['tile'], family: 'Marley', unitPrice: 0.9, packSize: null, defaultWastePct: 0, defaultLabourRate: 0, priceEditable: true, suggested: true },

    // ---- Barge / dry verge (lineal) ----
    { id: 'readyslate-verge', name: 'ReadySlate Aluminium Dry Verge 18mm Black 1m', code: 'BRS-RS-1M', basis: 'lineal', groups: ['barges'], component: 'barge', roofTypes: ['slate'], unitPrice: 14.5, packSize: null, defaultWastePct: 5, defaultLabourRate: 9.0, priceEditable: true },
    { id: 'manthorpe-slate-verge', name: 'Manthorpe Slate Dry Verge - Grey/Black', code: 'BRS-MP-SLT', basis: 'lineal', groups: ['barges'], component: 'barge', roofTypes: ['slate'], family: 'Manthorpe', unitPrice: 11.2, packSize: null, defaultWastePct: 5, defaultLabourRate: 9.0, priceEditable: true, suggested: true },
    { id: 'edgemere-verge-lh', name: 'Marley Edgemere Dry Verge LH - Smooth Grey', code: 'BRS-MA-LH', basis: 'lineal', groups: ['barges'], component: 'barge', roofTypes: ['tile'], family: 'Marley Edgemere', unitPrice: 9.8, packSize: null, defaultWastePct: 5, defaultLabourRate: 9.0, priceEditable: true, suggested: true },
    { id: 'edgemere-verge-rh', name: 'Marley Edgemere Dry Verge RH - Smooth Grey', code: 'BRS-MA-RH', basis: 'lineal', groups: ['barges'], component: 'barge', roofTypes: ['tile'], family: 'Marley Edgemere', unitPrice: 9.8, packSize: null, defaultWastePct: 5, defaultLabourRate: 9.0, priceEditable: true },

    // ---- Ridge (lineal) ----
    { id: 'manthorpe-ridge6', name: 'Manthorpe 6m Dry Ridge System - Black', code: 'RDG-MP-6M', basis: 'lineal', groups: ['ridges'], component: 'ridge', roofTypes: ['slate'], family: 'Manthorpe', unitPrice: 10.5, packSize: null, defaultWastePct: 5, defaultLabourRate: 11.0, priceEditable: true },
    { id: 'easytrim-ridge', name: 'Easy-Trim Ridge F Dry Fix Ridge Kit 6m Black', code: 'RDG-ET-6M', basis: 'lineal', groups: ['ridges'], component: 'ridge', roofTypes: ['slate', 'tile'], unitPrice: 9.7, packSize: null, defaultWastePct: 5, defaultLabourRate: 11.0, priceEditable: true, suggested: true },
    { id: 'marley-ridgefast', name: 'Marley RidgeFast Dry Fixing System 6m', code: 'RDG-MA-RF', basis: 'lineal', groups: ['ridges'], component: 'ridge', roofTypes: ['tile'], family: 'Marley', unitPrice: 11.3, packSize: null, defaultWastePct: 5, defaultLabourRate: 11.0, priceEditable: true, suggested: true },

    // ---- Valleys (lineal) ----
    { id: 'grp-slate-valley', name: 'Slate GRP Valley Trough', code: 'VAL-GRP-SLT', basis: 'lineal', groups: ['valleys'], component: 'valley', roofTypes: ['slate'], unitPrice: 18.0, packSize: null, defaultWastePct: 6, defaultLabourRate: 16.0, priceEditable: true, suggested: true },
    { id: 'grp-tile-valley', name: 'GRP Tile Valley Trough', code: 'VAL-GRP-TIL', basis: 'lineal', groups: ['valleys'], component: 'valley', roofTypes: ['tile'], unitPrice: 16.0, packSize: null, defaultWastePct: 6, defaultLabourRate: 16.0, priceEditable: true },

    // ---- Hips (lineal) ----
    { id: 'manthorpe-hip', name: 'Manthorpe Universal Dry Ridge & Hip System', code: 'HIP-MP-UNI', basis: 'lineal', groups: ['hips'], component: 'hip', roofTypes: ['slate', 'tile'], family: 'Manthorpe', unitPrice: 12.0, packSize: null, defaultWastePct: 5, defaultLabourRate: 12.0, priceEditable: true, suggested: true },
    { id: 'marley-hip', name: 'Marley Dry-Fix Hip System', code: 'HIP-MA-DF', basis: 'lineal', groups: ['hips'], component: 'hip', roofTypes: ['tile'], family: 'Marley', unitPrice: 13.0, packSize: null, defaultWastePct: 5, defaultLabourRate: 12.0, priceEditable: true },

    // ---- Spouting / gutter (lineal, all roofs) ----
    { id: 'floplast-gutter', name: 'FloPlast Half Round PVC Gutter 4m - Black', code: 'SPO-FP-4M', basis: 'lineal', groups: ['spouting'], component: 'gutter', roofTypes: ['all'], unitPrice: 3.9, packSize: null, defaultWastePct: 5, defaultLabourRate: 8.0, priceEditable: true, suggested: true },
    { id: 'evolve-gutter', name: 'EVOLVE Half Round Gutter 3m - Heritage Black', code: 'SPO-EV-3M', basis: 'lineal', groups: ['spouting'], component: 'gutter', roofTypes: ['all'], unitPrice: 4.7, packSize: null, defaultWastePct: 5, defaultLabourRate: 8.0, priceEditable: true },

    // ---- Downpipes (count) ----
    { id: 'evolve-downpipe', name: 'EVOLVE 76mm Flushfit Downpipe 3m - Black', code: 'DWN-EV-76', basis: 'count', groups: ['downpipes'], component: 'downpipe', roofTypes: ['all'], family: 'EVOLVE', unitPrice: 14.8, packSize: null, defaultWastePct: 0, defaultLabourRate: 24.0, priceEditable: true, suggested: true },
    { id: 'floplast-downpipe', name: 'FloPlast Round Downpipe - Black', code: 'DWN-FP-RD', basis: 'count', groups: ['downpipes'], component: 'downpipe', roofTypes: ['all'], family: 'FloPlast', unitPrice: 13.2, packSize: null, defaultWastePct: 0, defaultLabourRate: 24.0, priceEditable: true },
  ] as SupplierProduct[],
} as const;
