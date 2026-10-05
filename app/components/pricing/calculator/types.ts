export const DEVICES = ['mobile', 'desktop', 'mixed'] as const;
export const METHODS = ['existing', 'digital', 'printed'] as const;
export const TIERS = ['low', 'medium', 'high'] as const;
export const ASSISTANTS = ['none', 'light', 'regular', 'heavy'] as const;
export type Device = typeof DEVICES[number];
export type MeasurementMethod = typeof METHODS[number];
export type UsageTier = typeof TIERS[number];
export type TierChoice = 'recommended' | UsageTier;
export type AssistantLevel = typeof ASSISTANTS[number];
export type AssistantChoice = 'recommended' | AssistantLevel;
export type DigitalChoice = 'recommended' | 'on' | 'off';

/** Customer intentions, NEVER paid entitlements. V3 uses MONTHLY workload.
 * Do not reinterpret V1/V2 weekly answers as monthly quantities. */
export interface CalculatorAnswers {
  device: Device | null;
  quotesPerMonth: number | null;
  methods: MeasurementMethod[];
  capacity: TierChoice;
  digital: DigitalChoice;
  scan: boolean;
  scanAllowance: TierChoice;
  offcuts: boolean;
  assistant: AssistantChoice;
}
export interface PriceComponent { code: string; monthlyCents: number }
/** Internal consolidated selection = baseMonthlyCents + capacityCents. V4 billing splits it into Core and Capacity; never charge both representations. */
export interface CoreComponent { code: string; capacityCents: number; quotes: number; storageBytes: number }
export interface ScanComponent extends PriceComponent { tokens: number }
export interface AssistantComponent extends PriceComponent { tasks: number }
export interface CalculatorCatalog {
  id: string;
  revision: string;
  /** Preview means no billing approval. Numbers are owner-supplied, not random fixtures. */
  stage: 'preview' | 'approved';
  currency: 'USD' | 'NZD';
  locale: string;
  baseMonthlyCents: number;
  thresholds: { lowMax: number; mediumMax: number; maxInput: number };
  core: Record<UsageTier, CoreComponent>;
  digital: PriceComponent;
  scan: Record<UsageTier, ScanComponent>;
  offcuts: Record<UsageTier, PriceComponent>;
  assistant: Record<Exclude<AssistantLevel, 'none'>, AssistantComponent>;
  shareRule: string;
  scanRule: string;
  assistantRule: string;
}
export interface LineItem extends PriceComponent {
  kind: 'core' | 'digital' | 'scan' | 'offcuts' | 'assistant';
  label: string;
}
export interface Calculation {
  /** Workload band controls recommendations and Offcuts, NOT selected capacity. */
  usage: UsageTier;
  selectedCapacity: UsageTier;
  recommendedScan: UsageTier;
  selectedScan: UsageTier;
  recommendedAssistant: Exclude<AssistantLevel, 'none'>;
  selectedAssistant: AssistantLevel;
  digitalEnabled: boolean;
  scanEnabled: boolean;
  offcutsEnabled: boolean;
  lines: LineItem[];
  monthlyCents: number;
  limits: { quotes: number; storageBytes: number; scanTokens: number; assistantTasks: number };
  warnings: { code: 'assistant-lower' | 'quote-capacity' | 'scan-lower'; text: string }[];
}
export interface PlanIntent {
  schemaVersion: 2;
  catalogId: string;
  catalogRevision: string;
  answers: CalculatorAnswers;
}
export interface CurrentSubscription {
  billingSystem?: 'legacy' | 'custom_setup';
  displayName?: string;
  monthlyCents: number | null;
  currency: 'USD' | 'NZD';
  catalogRevision?: string;
  componentCodes?: string[];
}
export type CalculatorVariant = 'page' | 'signup' | 'billing';
export type ContinueResult = { message: string } | void;
export type ResultAction = 'demo' | 'free-tools' | 'takeoff-roofing' | 'takeoff-cladding' | 'takeoff-flooring' | 'book-demo' | 'done-for-you';
/** Host-owned destinations. No guessed route, calendar or production hostname. */
export interface TeamMember {
  name: string;
  role?: string;
  /** Real, approved portrait only. Never use generated staff photos. */
  photoSrc: string;
}
export interface ResultActions {
  links?: Partial<Record<ResultAction, string>>;
  /** Testing or in-app modal adapter. Prefer real links for navigation. */
  onAction?: (action: ResultAction, intent: PlanIntent) => Promise<ContinueResult> | ContinueResult;
  /** Context for the free-tools card; roofing is the default. Host owns tools-page routing. */
  trade?: 'roofing' | 'cladding' | 'flooring';
  /** Actual team assets; absent portraits are omitted, never fabricated. */
  team?: TeamMember[];
  setupRange?: { currency: 'USD' | 'NZD'; minCents: number; maxCents: number };
}
export interface PricingCalculatorProps {
  catalog: CalculatorCatalog;
  variant?: CalculatorVariant;
  initialAnswers?: CalculatorAnswers;
  startAtReview?: boolean;
  currentSubscription?: CurrentSubscription;
  onContinue?: (intent: PlanIntent) => Promise<ContinueResult> | ContinueResult;
  continueHref?: (intent: PlanIntent) => string;
  continueLabel?: string;
  resultActions?: ResultActions;
  notice?: string;
}
