/** Pure workspace vocabulary rules. Labels/aliases are DATA, never instructions. */
import { ASSISTANT_LIBRARY_ROLES, type AssistantLibraryRole } from '../library-workflow/contracts';

export type AssistantConcept = {
  key: string;
  displayName: string;
  aliases: string[];
  behavior: AssistantLibraryRole;
  builtin: boolean;
};
export const MAX_CUSTOM_CONCEPTS = 12;
export const BUILTIN_CONCEPTS: readonly AssistantConcept[] = [
  { key: 'roof_area', displayName: 'Roof covering', aliases: ['roof', 'roof area', 'roof covering', 'covering'], behavior: 'roof_area', builtin: true },
  { key: 'underlay', displayName: 'Underlay', aliases: ['underlay', 'underlayment'], behavior: 'underlay', builtin: true },
  { key: 'ridge', displayName: 'Ridge', aliases: ['ridge', 'ridges', 'ridging'], behavior: 'ridge', builtin: true },
  { key: 'hip', displayName: 'Hip', aliases: ['hip', 'hips'], behavior: 'hip', builtin: true },
  { key: 'valley', displayName: 'Valley', aliases: ['valley', 'valleys'], behavior: 'valley', builtin: true },
  { key: 'barge', displayName: 'Barge', aliases: ['barge', 'barges'], behavior: 'barge', builtin: true },
  { key: 'spouting', displayName: 'Spouting / gutter', aliases: ['spouting', 'gutter', 'gutters', 'guttering'], behavior: 'spouting', builtin: true },
  { key: 'fixings', displayName: 'Fixings', aliases: ['fixing', 'fixings', 'fastener', 'fasteners'], behavior: 'fixings', builtin: true },
];

/** Keep in parity with sa_v2_normalize_concept_alias in the additive migration. */
export function normalizeConceptAlias(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .map(token => token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token).join(' ');
}

export function validateVocabulary(concepts: readonly AssistantConcept[]): void {
  if (concepts.length > BUILTIN_CONCEPTS.length + MAX_CUSTOM_CONCEPTS) throw new Error('At most twelve custom concepts are supported.');
  const keys = new Set<string>(), aliases = new Map<string, string>();
  for (const c of concepts) {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(c.key) || keys.has(c.key)) throw new Error('Concept keys must be unique stable identifiers.');
    keys.add(c.key);
    if (!c.displayName.trim() || c.displayName.length > 80 || /[\u0000-\u001f]/.test(c.displayName)) throw new Error('Use a display name of 1–80 characters.');
    if (!ASSISTANT_LIBRARY_ROLES.includes(c.behavior)) throw new Error('Select a supported measurement behavior.');
    const base = BUILTIN_CONCEPTS.find(b => b.key === c.key);
    if (base && (!c.builtin || c.behavior !== base.behavior)) throw new Error('Built-in concept identity and behavior cannot change.');
    if (!base && (c.builtin || !c.key.startsWith('custom_'))) throw new Error('Custom concept keys must start with custom_.');
    if (!Array.isArray(c.aliases) || c.aliases.length > 24 || c.aliases.some(a => typeof a !== 'string' || !a.trim() || a.length > 80 || /[\u0000-\u001f]/.test(a))) throw new Error('Use at most 24 aliases, each 1–80 characters.');
    for (const label of [c.key, c.displayName, ...c.aliases]) {
      const normalized = normalizeConceptAlias(label);
      if (!normalized) throw new Error('Each concept name or alias needs letters or numbers.');
      const previous = aliases.get(normalized);
      if (previous && previous !== c.key) throw new Error(`“${label}” already belongs to another concept. Give each concept an unambiguous alias.`);
      aliases.set(normalized, c.key);
    }
  }
  if (BUILTIN_CONCEPTS.some(c => !keys.has(c.key))) throw new Error('Built-in concepts cannot be removed.');
}

export function resolveConcept(value: string, concepts: readonly AssistantConcept[]): AssistantConcept | null {
  const normalized = normalizeConceptAlias(value);
  const exact = concepts.filter(c => [c.key, c.displayName, ...c.aliases].some(a => normalizeConceptAlias(a) === normalized));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  // Bugfix 2026-10-05 (BUG B replay): the model often quotes the user verbatim
  // ("roofing underlay") instead of the bare alias ("underlay"). Fall back to a
  // UNIQUE whole-word containment of a key/alias inside the input. Two or more
  // candidate concepts remain unresolved - ambiguity is never guessed.
  const contained = concepts.filter(c => [c.key, ...c.aliases].some(a => {
    const alias = normalizeConceptAlias(a);
    return !!alias && new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).test(normalized);
  }));
  return contained.length === 1 ? contained[0] : null;
}

/** A concept cannot invent dimensions or calculation rules through its label. */
export function conceptSupportsMeasurement(behavior: AssistantLibraryRole, measurement: string): boolean {
  if (behavior === 'roof_area' || behavior === 'underlay') return measurement === 'area';
  if (behavior === 'fixings') return ['count', 'quantity', 'fixed', 'area'].includes(measurement);
  return ['lineal', 'linear'].includes(measurement);
}
