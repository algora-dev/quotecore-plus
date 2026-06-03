/**
 * AI Assistant — UI Element Registry (Phase 0B)
 * ==============================================
 *
 * Single source of truth mapping semantic `elementId`s to human metadata.
 * Plan §3.1a. This is the shared vocabulary for highlighting, guidance,
 * `visibleElements`, flow authoring (§6a) and future voice/mobile.
 *
 * CANONICAL CONTRACT (Gerald M-01):
 *  - The registry stores SEMANTIC metadata only — NO CSS selector lives in the
 *    canonical entry. Clients resolve `elementId` to their own ref:
 *      web    -> `[data-assistant-id="<id>"]`  (via {@link webSelectorFor})
 *      mobile -> native / accessibility ref     (client-side)
 *  - Exactly ONE web DOM attribute: `data-assistant-id`. (Legacy `data-copilot`
 *    is aliased only where the old engine still needs it during migration.)
 *
 * The registry is SEEDED from the existing `data-copilot` anchors
 * (`uiRegistry.generated.ts`, produced by scripts/seed-ui-registry.mjs) and
 * layered with curated labels/roles/descriptions in {@link CURATED}. Entries
 * without curation fall back to a humanised label + 'button' role so the
 * registry is usable immediately and refined over time.
 */

import { UI_REGISTRY_SEED } from './uiRegistry.generated';
import type { ElementId } from './protocol';

export type UiRole =
  | 'button'
  | 'input'
  | 'dropdown'
  | 'modal'
  | 'table'
  | 'menu-item'
  | 'tab'
  | 'link';

export interface UiRegistryEntry {
  id: ElementId;
  label: string;
  screenKey: string;
  role: UiRole;
  description: string;
}

/** Curated overrides layered on top of the seed. Add rows as flows need them. */
const CURATED: Record<
  string,
  Partial<Omit<UiRegistryEntry, 'id'>>
> = {
  'add-component': {
    label: 'Add Component',
    role: 'button',
    description: 'Opens the new-component form on the Components page.',
  },
  'component-name': {
    label: 'Component name',
    role: 'input',
    description: 'The name of the component being created or edited.',
  },
  'component-measurement': {
    label: 'Measurement type',
    role: 'dropdown',
    description:
      'How the component is measured: area, lineal, quantity, or fixed.',
  },
  'component-save': {
    label: 'Save component',
    role: 'button',
    description: 'Saves the component to your library.',
  },
  'nav-components': {
    label: 'Components',
    role: 'menu-item',
    description: 'Navigates to the Components page.',
  },
};

function humanise(id: string): string {
  return id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Build the registry once at module load from seed + curated overrides. */
const REGISTRY: Map<string, UiRegistryEntry> = (() => {
  const map = new Map<string, UiRegistryEntry>();
  for (const seed of UI_REGISTRY_SEED) {
    const curated = CURATED[seed.id] ?? {};
    map.set(seed.id, {
      id: seed.id,
      label: curated.label ?? humanise(seed.id),
      screenKey: curated.screenKey ?? seed.screenKey,
      role: curated.role ?? 'button',
      description: curated.description ?? '',
    });
  }
  // Curated-only ids not present in the seed (e.g. new elements) still register.
  for (const [id, c] of Object.entries(CURATED)) {
    if (map.has(id)) continue;
    map.set(id, {
      id,
      label: c.label ?? humanise(id),
      screenKey: c.screenKey ?? '',
      role: c.role ?? 'button',
      description: c.description ?? '',
    });
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isRegisteredElement(id: string): id is ElementId {
  return REGISTRY.has(id);
}

export function getElement(id: string): UiRegistryEntry | null {
  return REGISTRY.get(id) ?? null;
}

export function allElementIds(): ElementId[] {
  return [...REGISTRY.keys()];
}

/** Web-only: resolve a semantic id to its DOM selector. Never sent over the wire. */
export function webSelectorFor(id: ElementId): string {
  return `[data-assistant-id="${id}"]`;
}

/**
 * Highlight allowlist check: an id may be highlighted only if it is registered
 * AND currently reported visible by the client (intersection enforced here so
 * the model can't highlight off-screen / unknown elements).
 */
export function canHighlight(
  id: string,
  visibleElementIds: readonly string[]
): id is ElementId {
  return isRegisteredElement(id) && visibleElementIds.includes(id);
}
