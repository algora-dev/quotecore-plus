/** Pure auto-match: extracted measurement lines ↔ pricing-library components.
 * No IO — trivially unit-testable. Scoring blends token overlap with the
 * roofing rulebook's keyword slots (the same rules the pricing assistant
 * uses), then guards against measurement-family mismatches. */
import { classifyRoofing } from '@/app/lib/pricing-setup/roofing-rules';
import { familyOf, type MeasurementFamily } from './domain';

export type MatchComponent = {
  id: string; name: string; sku?: string | null; measurement_type: string; notes?: string | null;
  /** Display-only fields (owner 2026-11-16): the review page previews waste-adjusted
   *  values and item+labour cost exactly like the quote builder. Absent on the
   *  slim rows used by pure matching tests. */
  default_material_rate?: number | null;
  default_labour_rate?: number | null;
  default_waste_type?: string | null;
  default_waste_percent?: number | null;
  default_waste_fixed?: number | null;
  waste_unit?: string | null;
  pricing_strategy?: string | null;
  pack_price?: number | null;
  pack_size?: number | null;
};
export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';
export type MatchResult = {
  componentId: string | null; name: string | null; confidence: MatchConfidence;
};

const STOP = new Set(['the', 'and', 'of', 'to', 'for', 'front', 'rear', 'back', 'left', 'right', 'side', 'total']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(t => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
    .filter(t => t.length > 1 && !STOP.has(t) && !/^\d+(\.\d+)?$/.test(t));
}

/** Roofing keyword slot for a label or component name ('custom' = no rule hit). */
export function slotOf(text: string): string {
  return classifyRoofing(text, '').slot;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

function nameScore(labelTokens: Set<string>, componentText: string): number {
  const compTokens = tokenize(componentText);
  if (!compTokens.length) return 0;
  const compSet = new Set(compTokens);
  const d = dice(labelTokens, compSet);
  // Containment ("hip" inside "hip cap flashing") is a strong signal even
  // when the component name is much longer than the raw label.
  let contained = 0;
  for (const t of labelTokens) if (compSet.has(t)) contained++;
  const containment = labelTokens.size ? contained / labelTokens.size : 0;
  return Math.max(d, containment * 0.9);
}

/** Family compatibility between a line's physical kind and a component. */
function familyCompatible(kind: 'area' | 'lineal' | 'quantity' | null, family: MeasurementFamily): boolean {
  if (family === 'special') return false;
  if (kind === null) return true;
  return kind === family;
}

export function matchLine(
  label: string,
  kind: 'area' | 'lineal' | 'quantity' | null,
  components: MatchComponent[],
): MatchResult {
  const labelTokens = new Set(tokenize(label));
  if (!labelTokens.size) return { componentId: null, name: null, confidence: 'none' };
  const labelSlot = slotOf(label);

  let best: { component: MatchComponent; score: number } | null = null;
  for (const component of components) {
    const family = familyOf(component.measurement_type);
    if (!familyCompatible(kind, family)) continue;
    let score = nameScore(labelTokens, `${component.name} ${component.sku ?? ''}`);
    // Roofing rulebook agreement: "Hips front" and "Hip cap" both resolve to
    // the hip slot. Two independent keyword hits beat raw token overlap alone.
    if (labelSlot !== 'custom' && slotOf(component.name) === labelSlot) score = Math.max(score, 0.72);
    // A unit-bearing label already knows its physical kind, so an exact
    // family agreement deserves a modest boost over a generic name match.
    if (kind !== null && family === kind && score > 0.5) score += 0.05;
    if (!best || score > best.score) best = { component, score };
  }
  if (!best || best.score < 0.3) return { componentId: null, name: null, confidence: 'none' };
  const confidence: MatchConfidence = best.score >= 0.75 ? 'high' : best.score >= 0.5 ? 'medium' : 'low';
  return { componentId: best.component.id, name: best.component.name, confidence };
}

/** Convenience: build line_data defaults for one extracted line. */
export function matchExtraction(
  lines: Array<{ label: string; kind: 'area' | 'lineal' | 'quantity' | null }>,
  components: MatchComponent[],
): MatchResult[] {
  return lines.map(line => matchLine(line.label, line.kind, components));
}
