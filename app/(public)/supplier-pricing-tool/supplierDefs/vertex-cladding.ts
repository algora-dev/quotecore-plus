// Demo supplier definition: Vertex Cladding - the walls & cladding build of
// the supplier pricing tool (parent-area model, trade = 'cladding').
// Everything supplier-specific lives here like burton-roofing.ts.

import type { SupplierProduct } from '../types';

export const VERTEX_CLADDING = {
  slug: 'vertex-cladding',
  trade: 'cladding' as const,
  name: 'Vertex Cladding',
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
  ] as SupplierProduct[],
} as const;
