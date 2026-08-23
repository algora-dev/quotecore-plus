'use client';

// CSV parsing + column mapping for the Free Quote Builder step 1.
// Client-side only (papaparse). Field targets mirror BuilderComponent.

import Papa from 'papaparse';
import type { BuilderComponent } from './types';
import { makeId } from './types';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: 'greedy',
  });
  const rows = (result.data as string[][]).filter(r => r.some(c => (c ?? '').trim() !== ''));
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h, i) => (h ?? '').trim() || `Column ${i + 1}`);
  const body = rows.slice(1);
  return { headers, rows: body };
}

/** Map-able component fields. `required` fields must be mapped before import. */
export const MAPPABLE_FIELDS = [
  { key: 'name', label: 'Component name', required: true },
  { key: 'materialRate', label: 'Material price / unit', required: false },
  { key: 'labourRate', label: 'Labour rate / unit', required: false },
  { key: 'packSize', label: 'Pack size', required: false },
  { key: 'packPrice', label: 'Pack price', required: false },
  { key: 'wastePercent', label: 'Waste %', required: false },
] as const;

export type FieldKey = (typeof MAPPABLE_FIELDS)[number]['key'];
export type ColumnMapping = Partial<Record<FieldKey, number>>;

function toNumber(v: string | undefined): number {
  if (!v) return 0;
  // strip currency symbols, commas, spaces; handle "1 234,56" and "1,234.56"
  let s = v.replace(/[$\u00a3\u20ac\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Guess sensible default column mappings from headers (name-like, price-like...). */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = headers.map(h => h.toLowerCase());
  const findIdx = (patterns: RegExp[]): number => {
    for (const p of patterns) {
      const i = lower.findIndex(h => p.test(h));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = findIdx([/^(name|item|description|product|component)/, /name/, /item/]);
  if (idx >= 0) mapping.name = idx;
  const mat = findIdx([/material/, /price/, /cost/, /rate/, /unit\s*price/]);
  if (mat >= 0) mapping.materialRate = mat;
  const lab = findIdx([/labour/, /labor/, /wage/]);
  if (lab >= 0) mapping.labourRate = lab;
  const ps = findIdx([/pack\s*size/, /bundle/, /qty\s*per\s*pack/]);
  if (ps >= 0) mapping.packSize = ps;
  const pp = findIdx([/pack\s*price/, /bundle\s*price/, /pack\s*cost/]);
  if (pp >= 0) mapping.packPrice = pp;
  const wp = findIdx([/waste/]);
  if (wp >= 0) mapping.wastePercent = wp;
  return mapping;
}

/** Build components from selected rows using the column mapping. */
export function componentsFromRows(
  csv: ParsedCsv,
  mapping: ColumnMapping,
  selectedRowIdx: number[],
  measurementType: 'lineal' | 'area' | 'quantity',
): BuilderComponent[] {
  const out: BuilderComponent[] = [];
  for (const i of selectedRowIdx) {
    const row = csv.rows[i];
    if (!row) continue;
    const get = (k: FieldKey): string | undefined =>
      mapping[k] != null && mapping[k]! < row.length ? (row[mapping[k]! as number] ?? '').trim() : undefined;
    const name = get('name');
    if (!name) continue;
    const packSize = toNumber(get('packSize'));
    const packPrice = toNumber(get('packPrice'));
    const isPack = packSize > 0 && packPrice > 0;
    const waste = toNumber(get('wastePercent'));
    out.push({
      id: makeId('comp'),
      name: name.slice(0, 120),
      measurementType,
      materialRate: toNumber(get('materialRate')),
      labourRate: toNumber(get('labourRate')),
      pricingStrategy: isPack ? (measurementType === 'area' ? 'per_pack_area' : 'per_pack_length') : 'per_unit',
      packPrice: isPack ? packPrice : null,
      packSize: isPack ? packSize : null,
      wasteType: waste > 0 ? 'percent' : 'none',
      wasteValue: waste > 0 ? waste : 0,
      // CSV import cannot infer pitch logic; user can enable per component after import.
      pitchEnabled: false,
      pitchType: 'none',
      source: 'csv',
    });
  }
  return out;
}
