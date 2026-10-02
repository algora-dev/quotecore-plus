/**
 * Free tool AI placeholder components.
 *
 * The workstation's AI apply path (desktop `handleApplyAiResults` and the
 * touch scan2/3 flow) requires system placeholder components for the lineal
 * semantic keys — `buildSystemComponentIds` only counts `is_system` rows and
 * the apply guard rejects when fewer than 5 keys resolve
 * ("System components not fully seeded"). The app provisions these rows via
 * the `ensure_ai_system_components` DB seed; the free tool has no database,
 * so it passes them alongside the manual defaults instead.
 *
 * Names MUST equal the registry `systemName` values so `resolveSemanticKey`
 * maps them (normalisation strips spaces/underscores, but keep exact).
 * `is_system: true` keeps them out of every manual picker while remaining
 * valid reassign targets' sources in the existing pink-line review UX.
 */

export interface FreeToolPlaceholderComponent {
  id: string;
  name: string;
  measurement_type: string;
  is_system: boolean;
  collection_id: string;
}

export const AI_PLACEHOLDER_NAMES = [
  'ridge',
  'hip',
  'valley',
  'broken_hip',
  'barge',
  'spouting',
] as const;

export const AI_PLACEHOLDER_COMPONENTS: FreeToolPlaceholderComponent[] = AI_PLACEHOLDER_NAMES.map(
  (name) => ({
    id: `ai-system-${name}`,
    name,
    measurement_type: 'lineal',
    is_system: true,
    collection_id: 'tool-ai',
  }),
);
