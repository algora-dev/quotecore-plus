/**
 * AI Takeoff — Component Registry.
 *
 * Single source of truth for the 5 lineal placeholder types
 * (Ridge, Hip, Valley, Barge, Spouting).
 *
 * Canvas drawing, sidebar bars, hydration, and placeholder replacement
 * ALL consume this registry — no hard-coded colour maps elsewhere.
 *
 * System placeholder components NEVER receive palette-by-order colours.
 * Their colour is always their semantic colour from this registry.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/** Semantic key matching the AI response component array names. */
export type SemanticKey = 'ridges' | 'hips' | 'valleys' | 'broken_hips' | 'barges' | 'spouting';

/** Registry entry for one placeholder type. */
export interface AiComponentDefinition {
  /** Semantic key (matches AiScanData.components keys). */
  key: SemanticKey;
  /** Human-readable display name. */
  displayName: string;
  /** System component name in the DB (lowercase, matches ensure_ai_system_components seed). */
  systemName: string;
  /** Locked colour for canvas strokes + sidebar bar. */
  colour: string;
  /** Whether this type uses a dashed stroke on canvas. */
  dashed: boolean;
  /** Tailwind classes for the modal mini-stat badge. */
  badgeClasses: string;
}

// ── Registry ────────────────────────────────────────────────────────────────

export const AI_COMPONENT_REGISTRY: Record<SemanticKey, AiComponentDefinition> = {
  ridges: {
    key: 'ridges',
    displayName: 'Ridge',
    systemName: 'ridge',
    colour: '#22C55E', // green
    dashed: false,
    badgeClasses: 'bg-green-100 text-green-700',
  },
  hips: {
    key: 'hips',
    displayName: 'Hip',
    systemName: 'hip',
    colour: '#EF4444', // red
    dashed: false,
    badgeClasses: 'bg-red-100 text-red-700',
  },
  valleys: {
    key: 'valleys',
    displayName: 'Valley',
    systemName: 'valley',
    colour: '#EAB308', // yellow
    dashed: false,
    badgeClasses: 'bg-yellow-100 text-yellow-700',
  },
  broken_hips: {
    key: 'broken_hips',
    displayName: 'Broken Hip',
    systemName: 'broken_hip',
    colour: '#F97316', // orange
    dashed: false,
    badgeClasses: 'bg-orange-100 text-orange-700',
  },
  barges: {
    key: 'barges',
    displayName: 'Barge',
    systemName: 'barge',
    colour: '#A855F7', // purple
    dashed: false,
    badgeClasses: 'bg-purple-100 text-purple-700',
  },
  spouting: {
    key: 'spouting',
    displayName: 'Spouting',
    systemName: 'spouting',
    colour: '#FFFFFF', // white
    dashed: true,
    badgeClasses: 'bg-slate-100 text-slate-700',
  },
};

/** Ordered list of all semantic keys. */
export const ALL_SEMANTIC_KEYS: SemanticKey[] = ['ridges', 'hips', 'valleys', 'broken_hips', 'barges', 'spouting'];

/** Dash array for spouting (the only dashed type). */
export const SPOUTING_DASH_ARRAY = [8, 4];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve a system component DB row to its semantic key.
 * Returns null if the component name doesn't match any registry entry.
 */
export function resolveSemanticKey(componentName: string): SemanticKey | null {
  const lower = componentName.toLowerCase();
  for (const key of ALL_SEMANTIC_KEYS) {
    if (AI_COMPONENT_REGISTRY[key].systemName === lower) return key;
  }
  return null;
}

/**
 * Build the systemComponentIds map (SemanticKey → component_library.id)
 * from a list of component library rows.
 */
export function buildSystemComponentIds(
  components: { id: string; name: string; is_system?: boolean }[],
): Record<SemanticKey, string> {
  const map: Partial<Record<SemanticKey, string>> = {};
  for (const comp of components) {
    if (!comp.is_system) continue;
    const key = resolveSemanticKey(comp.name);
    if (key) map[key] = comp.id;
  }
  return map as Record<SemanticKey, string>;
}

/**
 * Get the colour for a semantic key.
 * This is the ONLY function that should be called to get an AI component colour.
 */
export function getSemanticColour(key: SemanticKey): string {
  return AI_COMPONENT_REGISTRY[key].colour;
}

/**
 * Get the line options for a semantic key (stroke colour, dash array, etc).
 */
export function getLineOptions(key: SemanticKey): {
  stroke: string;
  strokeWidth: number;
  strokeDashArray?: number[];
} {
  const def = AI_COMPONENT_REGISTRY[key];
  const opts: { stroke: string; strokeWidth: number; strokeDashArray?: number[] } = {
    stroke: def.colour,
    strokeWidth: 2,
  };
  if (def.dashed) opts.strokeDashArray = SPOUTING_DASH_ARRAY;
  return opts;
}
