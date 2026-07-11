/**
 * TradeConfig — the single config object that drives every trade calculator page.
 *
 * One shared engine (`TradeCalculator.tsx` + `_shared/tabs/*`), N trade pages.
 * Each trade page is: a config (this shape) + unique SEO copy. Adding a new
 * trade = new config file + thin layout/page pair. No engine changes.
 *
 * See docs/TRADE-CALCULATORS-PLAN.md for the SEO strategy.
 */

// ─── Tab registry ────────────────────────────────────

export type TabKind = 'area' | 'members' | 'gradient' | 'volume' | 'smart' | 'angle';

export interface TabDef {
  id: string;
  label: string;
  kind: TabKind;
}

// ─── Per-tab configs ─────────────────────────────────

/** Area tab: plan/actual area with optional slope factor. */
export interface AreaTabConfig {
  heading: string;
  subtitle: string;
  /** Word used for the slope concept: "Pitch" | "Slope" | "Gradient" */
  slopeWord: string;
  /** Label for plan-view area input, e.g. "Plan area" | "Plot area" | "Floor area" */
  planLabel: string;
  /** Label for the true surface area, e.g. "Actual roof area" | "Actual surface area" */
  actualLabel: string;
  /** Hint shown next to the Plan/Actual toggle in plan mode */
  planHint: string;
  /** Hint shown next to the Plan/Actual toggle in actual mode */
  actualHint: string;
  /** Note shown when Actual + dims mode selected */
  actualDimsNote: string;
  /** Apply 1/cos(slope) factor? false = flat area only (pitch UI hidden, factor 1) */
  useSlopeFactor: boolean;
  /** Quick-select slope values in degrees */
  commonSlopes: number[];
  defaultSlope: string;
  /** Label on the "send to smart component" button */
  useForPricingLabel: string;
}

/** Members tab: sloped member lengths (rafters, studs, stringers). */
export interface MembersTabConfig {
  heading: string;
  subtitle: string;
  slopeWord: string;
  /** Primary member name, e.g. "Rafter" | "Angled member" */
  memberLabel: string;
  spanLabel: string;
  spanHint: string;
  /** Show the Hip/Valley sub-tab (roofing only in practice) */
  showHipValley: boolean;
  hipPlanLabel?: string;
  hipPlanHint?: string;
  commonSlopes: number[];
  defaultSlope: string;
  /** Caption template under the diagram; {deg} is replaced */
  diagramCaption: string;
  /** Diagram vertex labels (roofing: "Ridge"/"Eaves"; generic: "Top"/"Base") */
  diagramTopLabel?: string;
  diagramBaseLabel?: string;
}

/** Gradient tab: degrees ⇄ 1-in-X ⇄ percent, fall over a run. */
export interface GradientTabConfig {
  heading: string;
  subtitle: string;
  /** Quick-select "1 in X" values, e.g. [40, 60, 80] for drainage falls */
  commonRatios: number[];
  runLabel: string;
  runHint: string;
  /** Word for the vertical change: "fall" | "rise" */
  fallWord: string;
}

/** Volume tab: L × W × depth with depth presets (concrete-first). */
export interface VolumeTabConfig {
  heading: string;
  subtitle: string;
  depthPresets: { label: string; mm: number }[];
  /** Density used for weight estimate (kg/m³); 0 hides the weight card */
  densityKgPerM3: number;
  densityLabel: string;
  defaultWastePercent: string;
  useForPricingLabel: string;
}

/** Draft Smart Component tab: default spec seeds per trade. */
export interface SmartTabConfig {
  heading: string;
  subtitle: string;
  defaultName: string;
  defaultMeasurementType: string;
  defaultWasteValue: string;
  defaultPricePerUnit: string;
  defaultPitchEnabled: boolean;
  /** Placeholder on the direct-area field */
  areaPlaceholder: string;
  /** Note shown when a value arrives from another tab */
  prefillNote: string;
}

/** Angle finder tab (roof-angle solver — used where flashings/angles apply). */
export interface AngleTabConfig {
  heading: string;
  subtitle: string;
}

// ─── Page copy ───────────────────────────────────────

export interface RelatedLink {
  href: string;
  title: string;
  desc: string;
}

export interface TradeContent {
  h1: string;
  heroText: string;
  tipsHeading: string;
  tips: { title: string; body: string }[];
  formulas: { name: string; formula: string }[];
  faqs: { q: string; a: string }[];
  /** Sibling calculators + free generators. Signup card is added automatically. */
  related: RelatedLink[];
}

// ─── Master config ───────────────────────────────────

export interface TradeConfig {
  /** URL slug without leading slash, e.g. "free-roofing-calculator" */
  slug: string;
  /** Display name used in JSON-LD, e.g. "Roofing Calculator" */
  name: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;

  tabs: TabDef[];
  area?: AreaTabConfig;
  members?: MembersTabConfig;
  gradient?: GradientTabConfig;
  volume?: VolumeTabConfig;
  smart: SmartTabConfig;
  angle?: AngleTabConfig;

  content: TradeContent;
}

/** signup href with attribution ref for a trade */
export function signupHref(config: Pick<TradeConfig, 'slug'>): string {
  return `/signup?ref=${config.slug}`;
}
