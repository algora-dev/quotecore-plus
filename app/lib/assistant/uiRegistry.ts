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
  'nav-quotes': {
    label: 'Quotes',
    role: 'menu-item',
    description: 'Main-nav link. Navigates to the Quotes page (your saved quotes).',
  },
  'nav-orders': {
    label: 'Orders',
    role: 'menu-item',
    description:
      'Main-nav link (labelled "Orders"). Navigates to the material orders hub. May be plan-gated (opens an upgrade prompt instead if the tier lacks Material Orders).',
  },
  'nav-resources': {
    label: 'Resources',
    role: 'menu-item',
    description:
      'Main-nav link. Opens the Resource Library hub - a cards page linking to Components, Drawings & Images, Catalogs, Attachments, and the template sections.',
  },
  'resources-card-components': {
    label: 'Components',
    role: 'menu-item',
    description:
      'The "Components" card on the Resource Library hub (/resources). Navigates to the Components page (manage reusable materials, labour items, and extras). Components is no longer in the main nav - reach it via Resources.',
  },
  // --- Dynamic/variable-bound anchors (ids computed at runtime, so the seed
  //     script can't auto-register them). Hand-registered here so
  //     request_ui_highlight will accept them. Keep in sync with
  //     docs/guide-me-target-ledger.md (run scripts/audit-guide-targets.mjs).
  'resources-card-attachments': {
    label: 'Attachments',
    role: 'menu-item',
    description:
      'The "Attachments" card on the Resource Library hub (/resources). Opens the attachment library (upload files once and reuse them across quotes and orders).',
  },
  'order-layout-line-by-line': {
    label: 'Line by Line layout',
    role: 'button',
    description:
      'The "Line by Line" card in the order layout picker. Chooses the clean itemised text layout (item, description, qty, price) for a material order. Layout cannot be changed after saving.',
  },
  'add-line-catalog-tab': {
    label: 'Search catalog tab',
    role: 'button',
    description:
      'The "Search catalog" tab inside the Add New Line picker on the Customer Quote editor. Switches the picker to catalog search so you can insert a priced supplier-catalog item as a quote line.',
  },
  'draw-flashing': {
    label: 'Draw Flashing',
    role: 'button',
    description:
      'The "Draw Flashing" button on the Flashings/Drawings library page (roofing trade). Opens the drawing canvas to create a flashing profile with measurements.',
  },
  'create-drawing': {
    label: 'Create Drawing',
    role: 'button',
    description:
      'The "Create Drawing" button on the Drawings & Images library page (generic trades). Opens the drawing canvas to create a drawing/image with measurements.',
  },
  'quote-add-from-library': {
    label: 'Add from library',
    role: 'button',
    description:
      'In the Quote Builder, the control that lets you pick a component from your library to add to the current roof/area.',
  },
  'quote-add-from-library-add-btn': {
    label: 'Add component (confirm)',
    role: 'button',
    description:
      'In the Quote Builder, the confirm/add button that actually drops the selected library component onto the quote.',
  },
  'quote-first-component': {
    label: 'First component',
    role: 'button',
    description:
      'In the Quote Builder, the first added component row — used to demonstrate expanding/editing a component on the quote.',
  },
  'nav-account': {
    label: 'Account',
    role: 'menu-item',
    description:
      'The "Account" link in the TOP-RIGHT corner of the header (a text pill labelled "Account", NOT an avatar, photo, or initials). Opens Account settings: company details, security/password, notifications, billing, support.',
  },
  'nav-help': {
    label: 'Help',
    role: 'button',
    description:
      'The "Help" button in the top-right header (question-mark icon + "Help"). Opens the help/docs drawer.',
  },
  'nav-alerts': {
    label: 'Alerts',
    role: 'button',
    description:
      'The notifications bell icon in the top-right header. Opens the alerts/notifications dropdown; shows an unread count badge.',
  },
  'nav-logout': {
    label: 'Logout',
    role: 'button',
    description: 'The "Logout" button in the top-right header. Signs the user out.',
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
