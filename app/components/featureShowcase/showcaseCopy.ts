/**
 * Feature showcase copy (owner directive 2026-10-14).
 *
 * One copy source for locked-feature teasers shown in the free takeoff
 * tools, the guided demo and the measurement-to-pricing tool. Every locked
 * feature stays VISIBLE; access varies by surface. Hover shows the short
 * tooltip, click opens the FeatureUpsellModal.
 *
 * The CTA routes to the production homepage (the sales pitch) because
 * free-tool visitors may have landed from search and never seen it.
 */

export const SHOWCASE_HOME_URL = 'https://quote-core.com';

export interface ShowcaseCopy {
  /** Button label. */
  label: string;
  /** Short hover tooltip. */
  tooltip: string;
  /** Modal heading. */
  title: string;
  /** Modal lead paragraph. */
  lead: string;
  /** Modal benefit bullets (empty = render none). */
  benefits: string[];
  /** Availability chip text. */
  availability: string;
  /** Primary CTA label. */
  ctaLabel: string;
}

export const SCAN_ASSIST_ROOFING: ShowcaseCopy = {
  label: 'AI Scan Assist',
  tooltip: 'Finds the roof outline and components automatically. Included in the main app.',
  title: 'AI Scan Assist',
  lead: 'Scan Assist reads your plan image, finds the roof outline and the roof components, then lets you review and adjust everything before it is saved.',
  benefits: [
    'Finds the roof outline and measures the roof area for you',
    'Detects ridges, hips, valleys and barges',
    'Review and adjust every result before anything is saved',
    'Saves time and helps if you are not roof-technical',
  ],
  availability: 'Included in the main app',
  ctaLabel: 'Check it out here',
};

export const SCAN_ASSIST_TRADE: ShowcaseCopy = {
  label: 'AI Scan Assist',
  tooltip: 'Finds outlines and components automatically. Live for roofing now, included in the main app.',
  title: 'AI Scan Assist',
  lead: 'Scan Assist reads your plan image, finds the outlines and the components, then lets you review and adjust everything before it is saved. It is currently live for roofing, with more trades coming.',
  benefits: [
    'Finds outlines and measures areas for you',
    'Detects the components automatically',
    'Review and adjust every result before anything is saved',
    'Saves time on every plan',
  ],
  availability: 'Live for roofing now, more trades coming. Included in the main app.',
  ctaLabel: 'Check it out here',
};

export const OFFCUTS: ShowcaseCopy = {
  label: 'Generate Offcuts',
  tooltip: 'Estimates real material use including reusable offcuts. Included in the main app.',
  title: 'Offcut Optimiser',
  lead: 'Generate Offcuts turns the measurements you just drew into a real-world material plan: the sheets and lengths you need plus the offcuts each cut creates, so you order what you will actually use.',
  benefits: [
    'Sees which offcuts are reusable on your next cuts',
    'Shows real sheet and length counts, not just raw totals',
    'Works from the roof you just measured',
    'Cuts the cost of over-ordering',
  ],
  availability: 'Included in the main app',
  ctaLabel: 'Check it out here',
};

export const SMART_ASSISTANT: ShowcaseCopy = {
  label: 'Smart Assistant',
  tooltip: 'Speak or type, and your assistant builds it for you.',
  title: 'Tell your assistant instead',
  lead: 'Prefer to just speak to your Smart Assistant? Voice or text, right on your phone, and it creates this exact same output or a full quote from your own pricing.',
  benefits: [
    'Voice or text, on your phone or desktop',
    'Builds quotes from your own pricing and components',
    'Knows your account: finds things, edits details, creates quotes and more',
    'You stay in control and can adjust anything it enters',
  ],
  availability: 'In the main app. Try it now with no sign-up in our guided demo',
  ctaLabel: 'Check it out here',
};
