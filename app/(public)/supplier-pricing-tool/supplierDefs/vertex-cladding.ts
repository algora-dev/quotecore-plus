// Demo supplier definition: Vertex Cladding - the walls & cladding build of
// the supplier pricing tool (parent-area model, trade = 'cladding').
// Everything supplier-specific lives here like burton-roofing.ts.

import type { SupplierProduct } from '../types';

export const VERTEX_CLADDING = {
  slug: 'vertex-cladding',
  trade: 'cladding' as const,
  name: 'Vertex Cladding',
  demo: true,
  tagline: 'Wall & Cladding Supplies',
  currency: '\u00A3', // GBP
  logoUrl: null,
  logoDarkUrl: null,
  brandColor: '#1F3A2E', // deep green
  theme: {
    primary: '#1F3A2E',
    primaryHover: '#2A4E3E',
    accent: '#2F6B4F',
    accentHover: '#265A42',
    border: '#9CC4AF',
    borderHover: '#79AE95',
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
    // ---- Wall coverings (area, applied per parent area) ----
    { id: 'vc-weatherboard-pine', name: 'Pine Weatherboard Primed 180mm', code: 'CLD-WB-P180', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 28.5, packSize: null, defaultWastePct: 8, defaultLabourRate: 22.0, priceEditable: true, suggested: true },
    { id: 'vc-weatherboard-cedar', name: 'Western Red Cedar Weatherboard 150mm', code: 'CLD-WB-C150', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 52.0, packSize: null, defaultWastePct: 8, defaultLabourRate: 24.0, priceEditable: true },
    { id: 'vc-fc-sheet-75', name: 'Fibre Cement Sheet 7.5mm Smooth', code: 'CLD-FC-75S', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Fibre Cement', unitPrice: 21.8, packSize: null, defaultWastePct: 10, defaultLabourRate: 18.0, priceEditable: true, suggested: true },
    { id: 'vc-fc-sheet-95', name: 'Fibre Cement Sheet 9.5mm Texture Base', code: 'CLD-FC-95T', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Fibre Cement', unitPrice: 26.4, packSize: null, defaultWastePct: 10, defaultLabourRate: 18.0, priceEditable: true },
    { id: 'vc-render-base', name: 'Polymer-Modified Render Base Coat (per m\u00B2 system)', code: 'CLD-RN-BASE', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Render', unitPrice: 16.9, packSize: null, defaultWastePct: 7, defaultLabourRate: 19.0, priceEditable: true },
    { id: 'vc-render-finish', name: 'Silicone Render Finish Coat (per m\u00B2 system)', code: 'CLD-RN-FIN', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Render', unitPrice: 14.2, packSize: null, defaultWastePct: 7, defaultLabourRate: 15.0, priceEditable: true },

    // ---- Behind-the-covering layers (area) ----
    { id: 'vc-building-wrap', name: 'Breathable Building Wrap 1.5m x 50m', code: 'UND-BW-150', basis: 'area', groups: ['areas'], component: 'underlay', roofTypes: ['all'], unitPrice: 2.4, packSize: null, defaultWastePct: 10, defaultLabourRate: 5.0, priceEditable: true, suggested: true },
    { id: 'vc-batten', name: 'Treated Battens 45x25 (per m\u00B2 coverage)', code: 'UND-BT-4525', basis: 'area', groups: ['areas'], component: 'underlay', roofTypes: ['all'], unitPrice: 4.1, packSize: null, defaultWastePct: 5, defaultLabourRate: 7.5, priceEditable: true },

    // ---- Paint / finish (area) ----
    { id: 'vc-paint-ext', name: 'Exterior Acrylic Paint System (2 coats, per m\u00B2)', code: 'FIN-PT-EXT', basis: 'area', groups: ['areas'], component: 'covering', roofTypes: ['all'], family: 'Paint', unitPrice: 5.8, packSize: null, defaultWastePct: 5, defaultLabourRate: 12.0, priceEditable: true },
    // ---- Wall lengths (lineal, applied per length component) ----
    { id: 'vc-cedar-trim', name: 'Cedar Window Trim 42mm', code: 'TRM-WB-42', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], family: 'Weatherboard', unitPrice: 6.4, packSize: null, defaultWastePct: 8, defaultLabourRate: 9.0, priceEditable: true, suggested: true },
    { id: 'vc-corner-trim', name: 'Aluminium Corner Trim 90\u00B0 - Black', code: 'TRM-CN-90', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 11.9, packSize: null, defaultWastePct: 5, defaultLabourRate: 10.0, priceEditable: true },
    { id: 'vc-joint-flashing', name: 'Z-Joint Flashing 25mm - Colorsteel', code: 'FLS-ZJ-25', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 8.7, packSize: null, defaultWastePct: 5, defaultLabourRate: 8.0, priceEditable: true },
    { id: 'vc-plaster-tape', name: 'Paper Tape for Plastering Joints 50mm', code: 'TPE-PP-50', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 0.85, packSize: null, defaultWastePct: 10, defaultLabourRate: 2.5, priceEditable: true },
    { id: 'vc-skirting', name: 'MDF Skirting 90mm Primed', code: 'TRM-SK-90', basis: 'lineal', groups: ['areas'], component: 'ridge', roofTypes: ['all'], unitPrice: 4.3, packSize: null, defaultWastePct: 8, defaultLabourRate: 9.5, priceEditable: true },

    // ---- Wall items (count, one-off fittings) ----
    { id: 'vc-wall-vent', name: 'Wall Vent 230x70mm - Colorsteel', code: 'ITM-WV-230', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 18.9, packSize: null, defaultWastePct: 0, defaultLabourRate: 22.0, priceEditable: true, suggested: true },
    { id: 'vc-louvres', name: 'Aluminium Louvre Vent 600x150mm', code: 'ITM-LV-600', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 34.5, packSize: null, defaultWastePct: 0, defaultLabourRate: 28.0, priceEditable: true },
    { id: 'vc-ext-light', name: 'Exterior Light Point (fitting only)', code: 'ITM-EL-PT', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 42.0, packSize: null, defaultWastePct: 0, defaultLabourRate: 45.0, priceEditable: true },
    { id: 'vc-tap-point', name: 'External Tap Point (fitting only)', code: 'ITM-TP-EX', basis: 'count', groups: ['areas'], component: 'downpipe', roofTypes: ['all'], unitPrice: 28.5, packSize: null, defaultWastePct: 0, defaultLabourRate: 35.0, priceEditable: true },
  ] as SupplierProduct[],
} as const;
