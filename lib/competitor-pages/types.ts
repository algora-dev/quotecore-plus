/**
 * Shared comparison-page system for competitor alternative pages
 * (/roofsnap-alternative, /eagleview-alternative, /planswift-alternative).
 *
 * Each page supplies its content as data; layout components render a
 * uniform structure matching the QuoteCore+ marketing design system:
 * white/zinc surfaces, orange accents, black rounded-full CTAs,
 * max-w-4xl content, rounded-[1.5rem]+ cards.
 *
 * Honesty rules (from the reviewed SEO plan, 2026-08-16):
 * - No fabricated capabilities. Unverified competitor cells say
 *   "Not publicly confirmed".
 * - Competitor pricing carries a visible checked date.
 * - "When [competitor] may be the better fit" section is mandatory.
 */

export type SupportStatus = "yes" | "partial" | "no" | "different" | "unconfirmed";

export type ComparisonRow = {
  feature: string;
  qc: { status: SupportStatus; note?: string };
  competitor: { status: SupportStatus; note?: string };
};

export type CompetitorPricingTier = {
  name: string;
  price: string;
  detail?: string;
};

export type CostScenario = {
  label: string;
  competitor: string;
  qc: string;
};

export type CompetitorFaq = { question: string; answer: string };

export type BestForCard = { title: string; body: string };

export type RelatedLink = { label: string; description: string; href: string };

export type CompetitorPageData = {
  slug: string; // e.g. "roofsnap-alternative"
  competitorName: string; // e.g. "RoofSnap"
  checkedDate: string; // human-readable, e.g. "August 2026"
  positioning: string; // one-line positioning statement
  hero: {
    title: string;
    sub: string;
  };
  quickAnswer: {
    heading: string;
    body: string; // 100-150 word immediate answer
  };
  bestFor: {
    competitorBestFor: BestForCard[];
    qcBestFor: BestForCard[];
  };
  workflow: {
    heading: string;
    intro: string;
    steps: Array<{ number: string; title: string; body: string }>;
  };
  comparison: {
    heading: string;
    intro: string;
    rows: ComparisonRow[];
  };
  pricing: {
    heading: string;
    intro: string;
    sourceNote: string;
    competitorTiers: CompetitorPricingTier[];
    scenarios: CostScenario[];
    scenarioNote?: string;
  };
  video: {
    heading: string;
    intro: string;
    // Placeholder until Shaun records page-specific videos
    videoKey: "quoteWalkthrough" | "smartComponents" | "roofingSmartComponents";
    ctaHref: string;
    ctaLabel: string;
  };
  honestWhen: {
    heading: string;
    intro: string;
    cards: BestForCard[];
  };
  freeTool: {
    heading: string;
    body: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryLinks: RelatedLink[];
  };
  faqs: CompetitorFaq[];
  related: RelatedLink[];
  finalCta: { heading: string; body: string };
};

export const STATUS_LABEL: Record<SupportStatus, string> = {
  yes: "Yes",
  partial: "Partial",
  no: "No",
  different: "Different approach",
  unconfirmed: "Not publicly confirmed",
};
