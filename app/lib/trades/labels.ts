/**
 * Generic Trades Phase 8 — trade-aware UI labels.
 *
 * Single source of truth for copy that varies by trade. Import and use
 * instead of hardcoding "Roof Areas" / "Add Roof Area" anywhere in the UI.
 *
 * Extend this map when new trades are added (one TRADE_LABELS entry per
 * trade value in the `trade` enum). The rest of the UI picks up the right
 * copy automatically.
 */

export type Trade = 'roofing' | 'generic';

export interface TradeLabels {
  /** Plural noun for the "areas" concept. e.g. "Roof Areas" or "Areas". */
  areaPluralLabel: string;
  /** Button / CTA to add a new area. */
  addAreaCta: string;
  /** Post-calibration optional prompt (generic only; roofing has a mandatory flow). */
  needAreaPrompt: string;
  /** Label for the "skip area" button in the optional prompt. */
  skipAreaCta: string;
  /** Whether pitch is a required field on the add-area form. */
  pitchRequired: boolean;
  /** Singular noun. */
  areaSingularLabel: string;
}

export const TRADE_LABELS: Readonly<Record<Trade, TradeLabels>> = {
  roofing: {
    areaPluralLabel: 'Roof Areas',
    areaSingularLabel: 'Roof Area',
    addAreaCta: 'Add Roof Area',
    needAreaPrompt: 'Do you want to measure a roof area first?',
    skipAreaCta: 'No, skip',
    pitchRequired: true,
  },
  generic: {
    areaPluralLabel: 'Areas',
    areaSingularLabel: 'Area',
    addAreaCta: 'Add Area',
    needAreaPrompt: 'Do you want to measure an area first?',
    skipAreaCta: 'No, skip',
    pitchRequired: false,
  },
};

/**
 * Safe accessor: falls back to roofing labels for unknown / legacy trade
 * values so a stale database row never breaks the UI.
 */
export function getTradeLabels(trade?: string | null): TradeLabels {
  if (trade === 'generic') return TRADE_LABELS.generic;
  return TRADE_LABELS.roofing;
}
