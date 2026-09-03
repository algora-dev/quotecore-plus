// Demo supplier definition: the FLOORING build of the supplier pricing tool
// (parent-area model, trade = 'flooring'). Simplified wall-system variant:
// area + lineal + count only, no angle, no length x height. Everything
// supplier-specific lives here like vertex-cladding.ts.

import type { SupplierProduct } from '../types';

export const OAKLINE_FLOORING = {
  slug: 'oakline-flooring',
  trade: 'flooring' as const,
  name: 'Oakline Flooring',
  tagline: 'Flooring Supplies',
  currency: '\u00A3', // GBP
  logoUrl: '/supplier-logos/oakline-flooring.svg',
  /** lighter logo variant for use on the dark brand-coloured header */
  logoDarkUrl: '/supplier-logos/oakline-flooring-header.svg',
  brandColor: '#42505C', // graphite grey
  demo: true,
  theme: {
    primary: '#42505C',
    primaryHover: '#51606D',
    accent: '#64748B',
    accentHover: '#475569',
    border: '#A8B4C0',
    borderHover: '#8B99A8',
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
    // ---- Floor coverings (area, applied per floor system) ----
    { id: 'of-hybrid-oak', name: 'Hybrid Flooring Oak 5.5mm 181mm', code: 'FLR-HY-OAK5', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Hybrid', unitPrice: 32.9, packSize: null, defaultWastePct: 8, defaultLabourRate: 18.0, priceEditable: true, suggested: true },
    { id: 'of-lvt-herringbone', name: 'LVT Herringbone Click 4.5mm', code: 'FLR-LVT-HB45', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'LVT', unitPrice: 41.5, packSize: null, defaultWastePct: 10, defaultLabourRate: 22.0, priceEditable: true },
    { id: 'of-laminate-8mm', name: 'Laminate Flooring 8mm AC4 Oak', code: 'FLR-LM-8OAK', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Laminate', unitPrice: 19.9, packSize: null, defaultWastePct: 8, defaultLabourRate: 14.0, priceEditable: true, suggested: true },
    { id: 'of-engineered-oak', name: 'Engineered Oak 18/4 189mm', code: 'FLR-EN-OAK189', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Engineered', unitPrice: 58.0, packSize: null, defaultWastePct: 10, defaultLabourRate: 26.0, priceEditable: true },
    { id: 'of-carpet-tile', name: 'Carpet Tile 50x50cm Commercial', code: 'FLR-CT-5050', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Carpet Tile', unitPrice: 17.5, packSize: null, defaultWastePct: 5, defaultLabourRate: 12.0, priceEditable: true },
    { id: 'of-vinyl-sheet', name: 'Sheet Vinyl 2mm Safety Flooring', code: 'FLR-VN-2MM', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Vinyl', unitPrice: 23.4, packSize: null, defaultWastePct: 10, defaultLabourRate: 16.0, priceEditable: true },

    // ---- Underlay / preparation layers (area) ----
    { id: 'of-underlay-hybrid', name: 'Acoustic Underlay 3mm (per m\u00B2 coverage)', code: 'UND-UL-3MM', basis: 'area', groups: ['areas'], component: 'underlay', roofTypes: ['all'], unitPrice: 4.8, packSize: null, defaultWastePct: 5, defaultLabourRate: 6.0, priceEditable: true, suggested: true },
    { id: 'of-underlay-laminate', name: 'Foam Underlay 2mm with DPM (per m\u00B2)', code: 'UND-UL-2MM', basis: 'area', groups: ['areas'], component: 'underlay', roofTypes: ['all'], unitPrice: 2.9, packSize: null, defaultWastePct: 5, defaultLabourRate: 5.0, priceEditable: true },
    { id: 'of-levelling-compound', name: 'Self-Levelling Compound 3mm (per m\u00B2)', code: 'UND-SL-3MM', basis: 'area', groups: ['areas'], component: 'underlay', roofTypes: ['all'], unitPrice: 7.2, packSize: null, defaultWastePct: 7, defaultLabourRate: 11.0, priceEditable: true },

    // ---- Floor edge lengths (lineal) ----
    { id: 'of-skirting-oak', name: 'Oak Skirting 119mm Prefinished', code: 'TRM-SK-O119', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Skirting', unitPrice: 12.8, packSize: null, defaultWastePct: 8, defaultLabourRate: 8.0, priceEditable: true, suggested: true },
    { id: 'of-skirting-mdf', name: 'MDF Skirting 96mm White Foil', code: 'TRM-SK-M96', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 4.6, packSize: null, defaultWastePct: 8, defaultLabourRate: 8.0, priceEditable: true },
    { id: 'of-scotia', name: 'Scotia Beading 19mm White', code: 'TRM-SC-19', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 2.4, packSize: null, defaultWastePct: 8, defaultLabourRate: 5.0, priceEditable: true },
    { id: 'of-transition-strip', name: 'Wood-to-Tile Transition Strip 32mm - Silver', code: 'TRM-TR-32', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 9.6, packSize: null, defaultWastePct: 5, defaultLabourRate: 7.0, priceEditable: true },
    { id: 'of-stair-nosing', name: 'Stair Nosing Flush Fit 50mm - Oak', code: 'TRM-SN-50', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 21.5, packSize: null, defaultWastePct: 5, defaultLabourRate: 14.0, priceEditable: true },

    // ---- Floor items (count, one-off fittings) ----
    { id: 'of-pipe-cover', name: 'Radiator Pipe Cover Set - Oak', code: 'ITM-PC-OAK', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 6.9, packSize: null, defaultWastePct: 0, defaultLabourRate: 8.0, priceEditable: true, suggested: true },
    { id: 'of-floor-grille', name: 'Air Vent Floor Grille 400x100mm - Brass', code: 'ITM-FG-400', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 24.0, packSize: null, defaultWastePct: 0, defaultLabourRate: 18.0, priceEditable: true },
    { id: 'of-floor-box', name: 'Floor Socket Box 2-Gang Brushed Steel', code: 'ITM-FB-2G', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 38.5, packSize: null, defaultWastePct: 0, defaultLabourRate: 45.0, priceEditable: true },
    { id: 'of-door-bar', name: 'Door Threshold Bar 900mm - Matt Black', code: 'ITM-DB-900', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 15.4, packSize: null, defaultWastePct: 0, defaultLabourRate: 10.0, priceEditable: true },
  ] as SupplierProduct[],
} as const;
