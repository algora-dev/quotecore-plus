/** Pure auto-match: extracted measurement lines ↔ pricing-library components.
 * No IO – trivially unit-testable. Scoring blends token overlap with the
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

/** Owner 2026-11-22: unify gerunds/participles with their root so
 * "Ridges"/"Ridging" and "Roll Top Ridging" share the same token space. */
const ALIAS: Record<string, string> = { ridging: 'ridge', guttering: 'gutter', capping: 'cap', corrugated: 'corrugate' };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(t => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
    .map(t => ALIAS[t] ?? t)
    .filter(t => t.length > 1 && !STOP.has(t) && !/^\d+(\.\d+)?$/.test(t));
}

/** Roofing keyword slot for a label or component name ('custom' = no rule hit). */
export function slotOf(text: string): string {
  return classifyRoofing(text, '').slot;
}

/** Token-overlap score plus how much of the component name the label explains. */
function nameDetail(labelTokens: Set<string>, componentText: string): { score: number; coverage: number } {
  const compTokens = tokenize(componentText);
  if (!compTokens.length) return { score: 0, coverage: 0 };
  const compSet = new Set(compTokens);
  let shared = 0;
  for (const t of labelTokens) if (compSet.has(t)) shared++;
  const d = (2 * shared) / (labelTokens.size + compSet.size);
  // Containment ("hip" inside "hip cap flashing") is a real signal, but
  // (owner 2026-11-22) containment alone must not reach HIGH when the
  // component adds qualifiers the source never wrote ("Valleys" ->
  // "Tapered Valley Flashing"). Dampen it by how much of the component name
  // the label actually explains; plain names also win the tie-break below.
  const containment = labelTokens.size ? shared / labelTokens.size : 0;
  const coverage = compSet.size ? shared / compSet.size : 0;
  return { score: Math.max(d, containment * 0.9 * (0.5 + 0.5 * coverage)), coverage };
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
  const labelKey = [...labelTokens].sort().join(' ');

  let best: { component: MatchComponent; score: number; coverage: number; tokenCount: number } | null = null;
  for (const component of components) {
    const family = familyOf(component.measurement_type);
    if (!familyCompatible(kind, family)) continue;
    const nameTokens = tokenize(component.name);
    const detail = nameDetail(labelTokens, `${component.name} ${component.sku ?? ''}`);
    let score = detail.score;
    // Roofing rulebook agreement: "Hips front" and "Hip cap" both resolve to
    // the hip slot. Two independent keyword hits beat raw token overlap alone.
    if (labelSlot !== 'custom' && slotOf(component.name) === labelSlot) score = Math.max(score, 0.72);
    // Owner 2026-11-22: exact name agreement is the only automatic HIGH
    // ("Roof area" <-> "Roof Area"). The old +0.05 family boost is gone —
    // with the 0.72 slot floor it pushed every rulebook match to HIGH and
    // defeated the qualifier penalty.
    if (nameTokens.length && [...nameTokens].sort().join(' ') === labelKey) score = Math.max(score, 1);
    // Tie-break: equal scores prefer the component the label explains best,
    // then the shorter name — "Valley Flashing" beats "Tapered Valley
    // Flashing" for a bare "Valleys" label.
    if (
      !best
      || score > best.score + 1e-9
      || (Math.abs(score - best.score) <= 1e-9
        && (detail.coverage > best.coverage + 1e-9
          || (Math.abs(detail.coverage - best.coverage) <= 1e-9 && nameTokens.length < best.tokenCount)))
    ) {
      best = { component, score, coverage: detail.coverage, tokenCount: nameTokens.length };
    }
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
