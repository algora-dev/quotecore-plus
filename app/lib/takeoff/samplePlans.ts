/**
 * Shared sample-plan catalogue for takeoff entry surfaces.
 *
 * Free takeoff tools reference these assets through their trade configs
 * (tradeConfig.ts) and the main-app New Quote / measure-a-job form resolves
 * the sample plan from the company's default trade (the Industry picker
 * overrides it when generic trades are enabled). Trades without a dedicated
 * plan fall back to the roof plan (owner decision 2026-10-13).
 *
 * The wall + floor assets are placeholders pending the owner's real plans;
 * swapping them in is a file replacement only - hrefs stay stable.
 */
export interface SamplePlan {
  /** Public asset path under /public. */
  href: string;
  /** Filename presented to the upload pipeline. */
  download: string;
  /** Noun for button copy ("Use a sample wall plan"). */
  label: 'roof' | 'wall' | 'floor';
}

export const ROOF_SAMPLE_PLAN: SamplePlan = {
  href: '/takeoff-demo/roofplan-baseline.png',
  download: 'QuoteCore-test-roof-plan.png',
  label: 'roof',
};

export const WALL_SAMPLE_PLAN: SamplePlan = {
  href: '/takeoff-demo/wallplan-baseline.png',
  download: 'QuoteCore-test-wall-plan.png',
  label: 'wall',
};

export const FLOOR_SAMPLE_PLAN: SamplePlan = {
  href: '/takeoff-demo/floorplan-baseline.png',
  download: 'QuoteCore-test-floor-plan.png',
  label: 'floor',
};

/** Resolve the sample plan for a trade value. Anything other than
 *  cladding/flooring falls back to the roof plan. */
export function resolveSamplePlan(trade: string | null | undefined): SamplePlan {
  if (trade === 'cladding') return WALL_SAMPLE_PLAN;
  if (trade === 'flooring') return FLOOR_SAMPLE_PLAN;
  return ROOF_SAMPLE_PLAN;
}
