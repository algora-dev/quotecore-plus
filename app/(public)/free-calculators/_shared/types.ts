/**
 * TradeConfig — the single config object that drives every trade calculator page.
 *
 * One shared engine (`TradeCalculator.tsx` + `_shared/tabs/*`), N trade pages.
 * Each trade page is: a config (this shape) + unique SEO copy. Adding a new
 * trade = new config file + thin layout/page pair. No engine changes.
 *
 * See docs/TRADE-CALCULATORS-PLAN.md for the SEO strategy.
 */

// ─── Currency ────────────────────────────────────────

export interface CurrencyDef {
  code: string;
  symbol: string;
  label: string;
}

/** Currencies offered in the dropdown next to Metric/Imperial. */
export const CURRENCIES: CurrencyDef[] = [
  { code: 'GBP', symbol: '£', label: '£ GBP' },
  { code: 'USD', symbol: '$', label: '$ USD' },
  { code: 'EUR', symbol: '€', label: '€ EUR' },
  { code: 'AUD', symbol: 'A$', label: 'A$ AUD' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZ$ NZD' },
  { code: 'CAD', symbol: 'C$', label: 'C$ CAD' },
];

// ─── Tab registry ────────────────────────────────────

export type TabKind = 'area' | 'members' | 'gradient' | 'volume' | 'smart' | 'angle' | 'batten';

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
  /** Show the Bird's Mouth sub-tab (rafters/stair stringers) */
  showBirdsmouth?: boolean;
  /** What the sloped timber is called in birdsmouth copy: "rafter" | "stringer" */
  birdsmouthMemberWord?: string;
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

/** Angle finder tab (angle solver — used where flashings/junctions/angles apply). */
export interface AngleTabConfig {
  heading: string;
  subtitle: string;
  /**
   * Word used for the slope concept in input labels, metric mode.
   * Roofing: "Pitch" → "Roof Pitch 1". Construction: "Angle" → "Angle 1".
   */
  angleWord?: string;
  /** Word swapped in when Imperial is selected (US-friendly). Default "Angle". */
  angleWordImperial?: string;
  /** Prefix on numbered inputs: "Roof" → "Roof Pitch 1"; omit for bare "Angle 1". */
  inputPrefix?: string;
  /** Label overrides for the two calc-type buttons. */
  hipValleyLabel?: string;
  rafterPitchLabel?: string;
  /** Tooltip/description overrides keyed by calc type / sub-type id. */
  tooltipOverrides?: Record<string, string>;
}

/** Batten tab: lineal metres of battens from roof area + gauge. */
export interface BattenTabConfig {
  heading: string;
  subtitle: string;
  /** Preset gauge options by tile/material type */
  gaugePresets: { label: string; mm: number }[];
  /** Default batten gauge in mm */
  defaultGauge: string;
  /** Default waste % */
  defaultWastePercent: string;
  /** Label on the "send to smart component" button */
  useForPricingLabel: string;
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
  /** Default currency code (see CURRENCIES); default "GBP" */
  defaultCurrency?: string;
  /** Default tab to show on page load (by tab id). Falls back to tabs[0]. */
  defaultTab?: string;
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
  batten?: BattenTabConfig;

  content: TradeContent;
}

/** signup href with attribution ref for a trade */
export function signupHref(config: Pick<TradeConfig, 'slug'>, draftId?: string): string {
  const base = `/signup?ref=${config.slug}`;
  return draftId ? `${base}&draft=${draftId}` : base;
}

/** Save a calculator draft to localStorage and return the draft ID. */
export function saveCalcDraft(config: Pick<TradeConfig, 'slug'>, data: unknown): string {
  const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (typeof window === 'undefined') return draftId;
  try {
    const key = `qcp:calc-draft:${draftId}`;
    localStorage.setItem(key, JSON.stringify({
      slug: config.slug,
      data,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // localStorage may be full or unavailable — silently continue
  }
  return draftId;
}

/** Load and remove a calculator draft from localStorage by ID. */
export function loadCalcDraft(draftId: string): { slug: string; data: unknown; savedAt: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `qcp:calc-draft:${draftId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Don't delete yet — let the app consume it first, then it can clean up
    return parsed;
  } catch {
    return null;
  }
}

/** Remove a consumed draft from localStorage. */
export function clearCalcDraft(draftId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`qcp:calc-draft:${draftId}`);
  } catch {
    // ignore
  }
}
