/** Measurements import contracts. These lines are NOT quote_components until
 * the user reviews and confirms them. Mirrors the pricing-setup draft model:
 * extraction output is untrusted until validated against a chosen component. */
import { z } from 'zod';

export const measurementEntrySchema = z.object({
  /** Value in the SOURCE unit as written in the document. Canonical metric
   * conversion happens only at confirm time, so the review always shows the
   * user exactly what was read. */
  value: z.number().finite().positive(),
  note: z.string().max(120).optional(),
});

export const measurementLineSchema = z.object({
  label: z.string().trim().min(1).max(180),
  unit: z.string().max(30).default(''),
  /** Owner 2026-11-22: true when the source had no unit and we pre-filled an
   * editable guess from the reading kind. Cleared once the user edits it. */
  unitGuessed: z.boolean().default(false),
  /** Best guess of what the numbers physically are. Derived from the source
   * unit and roofing keyword rules; the user never has to set it directly. */
  kind: z.enum(['area', 'lineal', 'quantity']).nullable().default(null),
  entries: z.array(measurementEntrySchema).min(1).max(50),
  matchedComponentId: z.string().uuid().nullable().default(null),
  matchedName: z.string().max(180).nullable().default(null),
  matchConfidence: z.enum(['high', 'medium', 'low', 'none']).default('none'),
  /** 'auto' suggestions are replaced when the library changes; 'user' picks survive a re-match. */
  matchOrigin: z.enum(['auto', 'user']).default('auto'),
  /** null = follow the import's master plan/actual setting. */
  basisOverride: z.enum(['plan', 'actual']).nullable().default(null),
  /** Ask the builder's combine machinery to merge the entries at confirm time (linear family only). */
  combineEntries: z.boolean().default(false),
  warnings: z.array(z.string().max(280)).max(10).default([]),
});
export type MeasurementLine = z.infer<typeof measurementLineSchema>;

export const editableLineSchema = measurementLineSchema.pick({
  label: true, unit: true, kind: true, entries: true,
  matchedComponentId: true, basisOverride: true, combineEntries: true,
});
export type EditableLine = z.infer<typeof editableLineSchema>;

export type MeasurementImportRow = {
  id: string; quote_id: string; source_kind: string; source_name: string;
  library_id: string | null; default_basis: 'plan' | 'actual';
  extracted_count: number; created_at: string;
};
export type MeasurementImportLineRow = {
  id: string; source_index: number; source_excerpt: string;
  status: 'candidate' | 'selected' | 'imported' | 'skipped';
  line_data: MeasurementLine; component_id: string | null;
};

/** Raw AI/parser output before any matching is applied. */
export type ExtractedMeasurementLine = {
  label: string; kind: 'area' | 'lineal' | 'quantity' | null;
  unit: string; entries: number[]; sourceIndex: number; excerpt: string;
};

/** Measurement-type families used for line↔component compatibility. Special
 * builder-only types (LxH, volume, freestyle) are never auto-matched and are
 * rejected at confirm with an actionable message. */
export type MeasurementFamily = 'area' | 'lineal' | 'quantity' | 'special';
const FAMILY_BY_TYPE: Record<string, MeasurementFamily> = {
  area: 'area', irregular_area: 'area',
  lineal: 'lineal', linear: 'lineal', multi_lineal: 'lineal', curved_line: 'lineal', quantity_by_spacing: 'lineal',
  quantity: 'quantity', count: 'quantity', fixed: 'quantity', hours_days: 'quantity',
  length_x_height: 'special', multi_lineal_lxh: 'special', length_x_height_freestyle: 'special',
  multi_lineal_lxh_freestyle: 'special', volume: 'special', volume_3d: 'special',
};
export function familyOf(measurementType: string): MeasurementFamily {
  return FAMILY_BY_TYPE[measurementType] ?? 'special';
}

const AREA_UNIT = /(?:^|[^a-z0-9])(?:m\s*(?:²|\^?2)|sq\.?\s*m|square\s*met(?:re|er)s?|m2|ft\s*(?:²|\^?2)|sq\.?\s*ft|square\s*feet|ft2|feet\s*(?:²|\^?2)|sq\.?\s*yards?|yd\s*(?:²|\^?2)|roofing\s*squares?)(?:$|[^a-z0-9])/i;
const ROOFING_SQUARE = /^(?:rs|sq|square|squares|roofing\s*squares?)$/i;
const LINEAL_UNIT = /^(?:m|lm|lin\.?\s*m|linear\s*met(?:re|er)s?|lineal\s*met(?:re|er)s?|met(?:re|er)s?|mm|millimet(?:re|er)s?|cm|centimet(?:re|er)s?|ft|feet|lin\.?\s*ft|linear\s*feet|lineal\s*feet|'|ft\.?|in|ins|inch(?:es)?|"|yd|yards?)$/i;
const COUNT_UNIT = /^(?:ea|each|pcs|pc|pieces?|no\.?|nos\.?|units?|items?|count|qty)$/i;

/** Infer the physical kind from the unit text exactly as extracted. */
export function kindFromUnit(unit: string): 'area' | 'lineal' | 'quantity' | null {
  const u = unit.trim();
  if (!u) return null;
  if (ROOFING_SQUARE.test(u) || AREA_UNIT.test(u)) return 'area';
  if (LINEAL_UNIT.test(u)) return 'lineal';
  if (COUNT_UNIT.test(u)) return 'quantity';
  return null;
}

/** Editable unit guess for unit-less lines (owner 2026-11-22): correcting one
 * wrong guess is faster than typing every missing unit by hand. */
export function guessUnitForKind(kind: 'area' | 'lineal' | 'quantity'): string {
  return kind === 'area' ? 'm²' : kind === 'lineal' ? 'm' : 'ea';
}

/** Lines that already look importable start selected (owner 2026-11-22) so
 * the default path is review-and-confirm; problem lines stay candidates. */
export function initialStatusFor(line: { matchedComponentId: string | null; unit: string }): 'selected' | 'candidate' {
  return line.matchedComponentId && kindFromUnit(line.unit) !== null ? 'selected' : 'candidate';
}

const LENGTH_TO_M: Array<[RegExp, number]> = [
  [/^(?:mm|millimet(?:re|er)s?)$/i, 0.001],
  [/^(?:cm|centimet(?:re|er)s?)$/i, 0.01],
  [/^(?:in|ins|inch(?:es)?|")$/i, 0.0254],
  [/^(?:ft|feet|'|ft\.?|lin\.?\s*ft|linear\s*feet|lineal\s*feet)$/i, 0.3048],
  [/^(?:yd|yards?)$/i, 0.9144],
  [/^(?:m|lm|lin\.?\s*m|linear\s*met(?:re|er)s?|lineal\s*met(?:re|er)s?|met(?:re|er)s?)$/i, 1],
];
const AREA_TO_M2: Array<[RegExp, number]> = [
  [/^(?:ft\s*(?:²|\^?2)|ft2|sq\.?\s*ft|square\s*feet|feet\s*(?:²|\^?2))$/i, 0.09290304],
  [/^(?:sq\.?\s*yards?|yd\s*(?:²|\^?2))$/i, 0.83612736],
  [/^(?:rs|sq|square|squares|roofing\s*squares?)$/i, 9.290304],
  [/^(?:m\s*(?:²|\^?2)|m2|sq\.?\s*m|square\s*met(?:re|er)s?)$/i, 1],
];

export function toCanonicalLength(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  const rule = LENGTH_TO_M.find(([re]) => re.test(u));
  return rule ? value * rule[1] : null;
}
export function toCanonicalArea(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  const rule = AREA_TO_M2.find(([re]) => re.test(u));
  return rule ? value * rule[1] : null;
}
/** Canonical conversion for a line entry; null means the unit was not recognised. */
export function toCanonicalValue(value: number, unit: string, kind: 'area' | 'lineal' | 'quantity' | null): number | null {
  if (kind === 'quantity') return value;
  if (kind === 'area') return toCanonicalArea(value, unit);
  if (kind === 'lineal') return toCanonicalLength(value, unit);
  return null;
}

export function resolvedBasis(line: Pick<MeasurementLine, 'basisOverride'>, sessionDefault: 'plan' | 'actual'): 'plan' | 'actual' {
  return line.basisOverride ?? sessionDefault;
}

/** Gate run per line at confirm time. Failures keep the line un-imported and
 * are reported with the line label, exactly like pricing confirm-all. */
export function validateForImport(
  line: MeasurementLine,
  component: { measurement_type: string } | null,
  sessionDefault: 'plan' | 'actual',
): string[] {
  const problems: string[] = [];
  if (!component || !line.matchedComponentId) {
    problems.push('Choose a component from your library for this line, or skip it.');
    return problems;
  }
  const family = familyOf(component.measurement_type);
  if (family === 'special') {
    problems.push(`${component.measurement_type.replace(/_/g, ' ')} components need their measurements entered in the quote builder.`);
    return problems;
  }
  if (!line.entries.length) problems.push('Add at least one measurement entry.');
  if (line.entries.some(e => !Number.isFinite(e.value) || e.value <= 0)) problems.push('Every entry needs a positive number.');
  if (line.kind && family !== line.kind) {
    problems.push(`This line looks like ${line.kind === 'area' ? 'an area' : line.kind === 'lineal' ? 'a length' : 'a count'} but the chosen component measures ${family === 'area' ? 'area' : family === 'lineal' ? 'length' : 'counts'}. Swap the component or edit the line.`);
  }
  if (toCanonicalValue(line.entries[0]?.value ?? NaN, line.unit, line.kind) === null && line.kind !== 'quantity') {
    problems.push(`The unit "${line.unit || '–'}" was not recognised. Enter it as m, m², ft, ft², sq or ea.`);
  }
  if (line.combineEntries && family === 'lineal' && line.entries.length < 2) {
    problems.push('Nothing to combine yet – add another entry first.');
  }
  void resolvedBasis(line, sessionDefault);
  return problems;
}
