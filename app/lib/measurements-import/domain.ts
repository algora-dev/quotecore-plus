/** Measurements import contracts. These lines are NOT quote_components until
 * the user reviews and confirms them. Mirrors the pricing-setup draft model:
 * extraction output is untrusted until validated against a chosen component. */
import { z } from 'zod';
import { normalizeMeasurementSystem, type MeasurementSystem } from '../types';

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
  /** Owner 2026-11-24: deterministic reading of the written "N x M" / "N at M"
   * pattern. Kept so the review can offer a one-tap swap when the
   * quantity/measurement split was ambiguous. */
  split: z.object({
    pairs: z.array(z.object({
      a: z.number().positive(),
      b: z.number().positive(),
      sep: z.enum(['x', 'at']),
      aUnit: z.string().max(30).nullable().default(null),
      bUnit: z.string().max(30).nullable().default(null),
      ambiguous: z.boolean(),
    })).max(20),
    ambiguous: z.boolean(),
  }).nullable().default(null),
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
 * wrong guess is faster than typing every missing unit by hand.
 * Owner 2026-11-24: the guess follows the quote/company measurement system –
 * ft for either imperial flavour, ft² or RS for areas. */
export function guessUnitForKind(kind: 'area' | 'lineal' | 'quantity', system: MeasurementSystem | string | null | undefined = null): string {
  const norm = normalizeMeasurementSystem(system as MeasurementSystem);
  if (kind === 'area') return norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
  if (kind === 'lineal') return norm === 'metric' ? 'm' : 'ft';
  return 'ea';
}

/** Lines that already look importable start selected (owner 2026-11-22) so
 * the default path is review-and-confirm; problem lines stay candidates.
 * Owner 2026-11-24: an ambiguous quantity/measurement split never
 * auto-selects – it has to be checked first. */
export function initialStatusFor(line: { matchedComponentId: string | null; unit: string; split?: { ambiguous: boolean } | null }): 'selected' | 'candidate' {
  if (line.split?.ambiguous) return 'candidate';
  return line.matchedComponentId && kindFromUnit(line.unit) !== null ? 'selected' : 'candidate';
}

/* ── Deterministic quantity/measurement split (owner 2026-11-24) ────────────
 * "N x M" / "N at M" patterns are re-derived in code from the transcribed
 * source line, because the vision model's split is non-deterministic. Rules,
 * in priority order:
 *   1. the number carrying a written unit is the measurement;
 *   2. otherwise a decimal number is the measurement and a round number is
 *      the quantity ("4.5 x 4" = four 4.5 m runs);
 *   3. "at"/"@" means quantity first ("2 at 4" = two 4 m runs);
 *   4. both round with "x" and no unit is genuinely ambiguous: default to
 *      quantity first ("2 x 4" = 2 runs of 4) and flag the line for review.
 * Two-number patterns are length readings by default; areas identify
 * themselves with an area unit. Quantities are whole numbers by convention –
 * measurements should be written with a decimal (4.0) to disambiguate. */

const SPLIT_UNIT = String.raw`(?:m\s*[²2]|sq\.?\s*m|ft\s*[²2]|sq\.?\s*ft|square\s*met(?:re|er)s?|square\s*feet|square\s*yards?|roofing\s*squares?|squares|rs|sq|lm|mm|cm|met(?:re|er)s?|feet|yards?|inch(?:es)?|ins|in|ft|yd|ea|each|pcs|pc|pieces|nos|no|m)`;

const SPLIT_PAIR_SOURCE =
  String.raw`(\d+(?:\.\d+)?)(?:\s*(` + SPLIT_UNIT + String.raw`)(?![a-z]))?\s*(?:([x×*])|\bat\b|@)\s*(\d+(?:\.\d+)?)(?:\s*(` + SPLIT_UNIT + String.raw`)(?![a-z]))?`;

export type SplitPair = {
  a: number; b: number; sep: 'x' | 'at';
  aUnit: string | null; bUnit: string | null;
  ambiguous: boolean;
};

/** Parse every "N x M" / "N at M" pair out of a transcribed source line. */
export function parseSplitPairs(text: string): SplitPair[] {
  const out: SplitPair[] = [];
  if (!text) return out;
  const re = new RegExp(SPLIT_PAIR_SOURCE, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && out.length < 20) {
    const a = Number(m[1]);
    const b = Number(m[4]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) continue;
    const norm = (u: string | undefined) => (u ? u.replace(/\s+/g, ' ').trim().toLowerCase() : null);
    const aUnit = norm(m[2]);
    const bUnit = norm(m[5]);
    const sep: 'x' | 'at' = m[3] ? 'x' : 'at';
    const ambiguous = (!!aUnit && !!bUnit) || (!aUnit && !bUnit && sep === 'x' && Number.isInteger(a) === Number.isInteger(b));
    out.push({ a, b, sep, aUnit, bUnit, ambiguous });
  }
  return out;
}

export type SplitReading = { entries: number[]; unit: string | null; ambiguous: boolean };

/** Apply the owner's split rules to the parsed pairs. `swapped` re-derives the
 * entries with the roles exchanged (the one-tap swap in the review UI). */
export function readSplit(pairs: SplitPair[], swapped = false): SplitReading {
  const entries: number[] = [];
  let unit: string | null = null;
  let ambiguous = false;
  for (const p of pairs) {
    let measurement: number;
    let quantity: number;
    let mUnit: string | null;
    if (p.aUnit && !p.bUnit) { measurement = p.a; quantity = p.b; mUnit = p.aUnit; }
    else if (p.bUnit && !p.aUnit) { measurement = p.b; quantity = p.a; mUnit = p.bUnit; }
    else if (Number.isInteger(p.a) !== Number.isInteger(p.b)) {
      measurement = Number.isInteger(p.a) ? p.b : p.a;
      quantity = Number.isInteger(p.a) ? p.a : p.b;
      mUnit = Number.isInteger(p.a) ? p.bUnit : p.aUnit;
    } else if (p.sep === 'at') { measurement = p.b; quantity = p.a; mUnit = p.bUnit; }
    else { measurement = p.b; quantity = p.a; mUnit = p.bUnit; ambiguous = true; }
    if (p.aUnit && p.bUnit) { measurement = p.a; quantity = p.b; mUnit = p.aUnit; ambiguous = true; }
    if (swapped) {
      const previous = measurement;
      measurement = quantity;
      quantity = previous;
      mUnit = measurement === p.a ? p.aUnit : p.bUnit;
    }
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 50) {
      for (let i = 0; i < quantity && entries.length < 50; i += 1) entries.push(measurement);
    } else {
      // A non-integer count is not a count – keep both numbers and flag it.
      entries.push(p.a, p.b);
      ambiguous = true;
    }
    if (mUnit && !unit) unit = mUnit;
  }
  return { entries, unit, ambiguous };
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
