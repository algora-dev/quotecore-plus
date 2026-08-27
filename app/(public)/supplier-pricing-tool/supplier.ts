// Demo supplier config - hardcoded per plan (one fictional supplier).
// This is the template every per-supplier build will swap out.
// Labour defaults are non-zero on common items so the demo output shows
// the full materials + labour story without Advanced-mode editing.

import type { SupplierProduct } from './types';

export const SUPPLIER = {
  name: 'Roofline Supplies',
  slug: 'roofline-supplies',
  tagline: 'Roofing materials, priced fast',
  unit: 'metric',
  currency: '$',
  mode: 'powered_by' as const, // powered_by | white_label
};

export const DEMO_CATALOG: SupplierProduct[] = [
  // Roof areas
  { id: 'p-tile', name: 'Concrete Roof Tile - Charcoal', code: 'TIL-CH-01', basis: 'area', groups: ['roofAreas'], unitPrice: 28.5, packSize: null, defaultWastePct: 7.5, defaultLabourRate: 12.9, priceEditable: true, suggested: true },
  { id: 'p-tile-ts', name: 'Terracotta Roof Tile - Classic', code: 'TIL-TC-02', basis: 'area', groups: ['roofAreas'], unitPrice: 36.9, packSize: null, defaultWastePct: 7.5, defaultLabourRate: 15.2, priceEditable: false },
  { id: 'p-underlay', name: 'Roofing Underlay - Double Sided', code: 'UND-DS-10', basis: 'area', groups: ['roofAreas'], unitPrice: 4.2, packSize: null, defaultWastePct: 10, defaultLabourRate: 6.6, priceEditable: true, suggested: true },
  { id: 'p-batten', name: 'Timber Roof Batten 50x25', code: 'BAT-5025', basis: 'area', groups: ['roofAreas'], unitPrice: 6.8, packSize: null, defaultWastePct: 5, defaultLabourRate: 8.4, priceEditable: false },
  { id: 'p-fixings', name: 'Roof Fixings Pack (per 10m2)', code: 'FIX-10M', basis: 'area', groups: ['roofAreas'], unitPrice: 3.5, packSize: null, defaultWastePct: 0, defaultLabourRate: 13.0, priceEditable: true, suggested: true },
  { id: 'p-eaveflash', name: 'Eave Flashing Trim (per m2)', code: 'EAV-FL-04', basis: 'area', groups: ['roofAreas'], unitPrice: 5.9, packSize: null, defaultWastePct: 5, defaultLabourRate: 0, priceEditable: false },

  // Ridges
  { id: 'p-dryridge', name: 'Dry Ridge System Kit (per m)', code: 'DRS-PM', basis: 'lineal', groups: ['ridges'], unitPrice: 21.4, packSize: null, defaultWastePct: 5, defaultLabourRate: 10.4, priceEditable: true, suggested: true },
  { id: 'p-ridgetile', name: 'Ridge Tile - Charcoal', code: 'RID-CH-01', basis: 'lineal', groups: ['ridges'], unitPrice: 12.8, packSize: null, defaultWastePct: 5, defaultLabourRate: 12.75, priceEditable: false },
  { id: 'p-ridgebed', name: 'Bedding Mortar (per m ridge)', code: 'BED-PM', basis: 'lineal', groups: ['ridges'], unitPrice: 8.2, packSize: null, defaultWastePct: 8, defaultLabourRate: 0, priceEditable: false },

  // Hips
  { id: 'p-hiptile', name: 'Hip Tile - Charcoal', code: 'HIP-CH-01', basis: 'lineal', groups: ['hips'], unitPrice: 14.2, packSize: null, defaultWastePct: 6, defaultLabourRate: 12.75, priceEditable: true, suggested: true },
  { id: 'p-hipflex', name: 'Flexible Hip Flashing', code: 'HIP-FL-05', basis: 'lineal', groups: ['hips'], unitPrice: 9.6, packSize: null, defaultWastePct: 8, defaultLabourRate: 0, priceEditable: false },

  // Valleys
  { id: 'p-valleytray', name: 'Valley Tray - Coloursteel', code: 'VAL-CS-03', basis: 'lineal', groups: ['valleys'], unitPrice: 18.9, packSize: null, defaultWastePct: 7, defaultLabourRate: 14.8, priceEditable: true, suggested: true },
  { id: 'p-valleyflash', name: 'Valley Flashing 300mm', code: 'VAL-FL-30', basis: 'lineal', groups: ['valleys'], unitPrice: 11.4, packSize: null, defaultWastePct: 7, defaultLabourRate: 0, priceEditable: false },

  // Barges
  { id: 'p-bargetile', name: 'Barge Tile - Charcoal', code: 'BAR-CH-01', basis: 'lineal', groups: ['barges'], unitPrice: 13.5, packSize: null, defaultWastePct: 6, defaultLabourRate: 12.75, priceEditable: true, suggested: true },
  { id: 'p-bargeflash', name: 'Barge Flashing', code: 'BAR-FL-01', basis: 'lineal', groups: ['barges'], unitPrice: 8.9, packSize: null, defaultWastePct: 7, defaultLabourRate: 6.75, priceEditable: false },

  // Spouting
  { id: 'p-spout', name: 'Spouting - 125mm Quad', code: 'SPO-125Q', basis: 'lineal', groups: ['spouting'], unitPrice: 16.8, packSize: null, defaultWastePct: 6, defaultLabourRate: 12.7, priceEditable: true, suggested: true },
  { id: 'p-spoutbrack', name: 'Spouting Brackets & Fittings', code: 'SPO-FIT-K', basis: 'lineal', groups: ['spouting'], unitPrice: 5.2, packSize: null, defaultWastePct: 5, defaultLabourRate: 3.15, priceEditable: true, suggested: true },

  // Downpipes (point-measured - counted, not lineal)
  { id: 'p-downpipe', name: 'Downpipe 80mm PVC (per ea)', code: 'DWN-80P', basis: 'count', groups: ['downpipes'], unitPrice: 38.5, packSize: null, defaultWastePct: 0, defaultLabourRate: 42.0, priceEditable: true, suggested: true },
  { id: 'p-dp-bracket', name: 'Downpipe Brackets & Offsets', code: 'DWN-BRK', basis: 'count', groups: ['downpipes'], unitPrice: 9.2, packSize: null, defaultWastePct: 0, defaultLabourRate: 0, priceEditable: false },
];
