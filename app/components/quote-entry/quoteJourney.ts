/** Experience 2: acquisition and assistance are independent presentation choices.
 * Stored entry_mode, server redirects and the pricing engine are unchanged.
 * There is deliberately no Guided route, picker, preference store or fake wizard.
 */
export type QuoteEntryMode = 'manual' | 'digital' | 'blank';
export type PricingExperience = 'advanced' | 'guided';
export const CURRENT_PRICING_EXPERIENCE = 'advanced' as const;
export const PRICING_EXPERIENCE_LABEL = 'Advanced';

/** Future callers may request assistance; unavailable modes must fail to the
 * real workspace, never to an unimplemented route. Wire Guided only after its
 * own implementation/acceptance. Do not overload entry_mode with this choice.
 */
export function resolvePricingExperience(_requested?: unknown): typeof CURRENT_PRICING_EXPERIENCE {
  return CURRENT_PRICING_EXPERIENCE;
}

/** Existing physical routes; both component paths render the same QuoteBuilder.
 * Keep digital /build and its step contract: Takeoff and mobile already use it.
 * Template creation owns its redirect in the existing server action.
 */
export function quoteJourneyDestination({ workspaceSlug, quoteId, entryMode, stage = 'start', experience }: {
  workspaceSlug: string; quoteId: string; entryMode: QuoteEntryMode;
  stage?: 'start' | 'pricing'; experience?: PricingExperience;
}): string {
  // The resolver is deliberately independent of how measurements were acquired.
  resolvePricingExperience(experience);
  const base = `/${encodeURIComponent(workspaceSlug)}/quotes/${encodeURIComponent(quoteId)}`;
  if (entryMode === 'blank') return `${base}/blank-build`;
  if (entryMode === 'digital') return stage === 'start' ? `${base}/takeoff` : `${base}/build?step=roof-areas`;
  return base;
}

/** Optional deep-link entry hint, never an entitlement or a persisted mode. */
export function entryModeFromHint(value: string | null): QuoteEntryMode | null {
  if (value === 'known') return 'manual';
  if (value === 'digital') return 'digital';
  return null;
}
