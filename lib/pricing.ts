export type CurrencyCode = "USD" | "GBP";

export type PricingPlan = {
  name: string;
  displayName: string;
  usd: string;
  gbp: string;
  schemaPriceUsd: number;
  schemaPriceGbp: number;
  originalUsd: string | null;
  originalGbp: string | null;
  subtitle: string;
  features: string[];
  featured: boolean;
  comingSoon: boolean;
  isFree: boolean;
  includeInSchema: boolean;
  contactUs?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    name: "Full trial",
    displayName: "Full trial",
    usd: "14 Days Free",
    gbp: "14 Days Free",
    schemaPriceUsd: 0,
    schemaPriceGbp: 0,
    originalUsd: null,
    originalGbp: null,
    subtitle: "A 14-day taste of everything",
    features: ["10 quotes", "100 MB storage", "20 AI Assist scan points", "All features unlocked", "No credit card needed"],
    featured: false,
    comingSoon: false,
    isFree: true,
    includeInSchema: true,
  },
  {
    name: "Lite",
    displayName: "Lite",
    usd: "Free",
    gbp: "Free",
    schemaPriceUsd: 0,
    schemaPriceGbp: 0,
    originalUsd: null,
    originalGbp: null,
    subtitle: "For individuals just getting started",
    features: ["5 quotes", "50 MB storage"],
    featured: false,
    comingSoon: false,
    isFree: true,
    includeInSchema: true,
  },
  {
    name: "Starter",
    displayName: "Starter",
    usd: "$19",
    gbp: "£14",
    schemaPriceUsd: 19,
    schemaPriceGbp: 14,
    originalUsd: "$40",
    originalGbp: "£30",
    subtitle: "For solo traders quoting regularly",
    features: ["25 quotes", "500 MB storage", "All core features", "No card for trial"],
    featured: false,
    comingSoon: false,
    isFree: false,
    includeInSchema: true,
  },
  {
    name: "Pro",
    displayName: "Pro",
    usd: "$39",
    gbp: "£29",
    schemaPriceUsd: 39,
    schemaPriceGbp: 29,
    originalUsd: "$90",
    originalGbp: "£68",
    subtitle: "For growing trade businesses",
    features: ["100 quotes", "3 GB storage", "50 AI Assist scan points", "All core features", "Priority support"],
    featured: true,
    comingSoon: false,
    isFree: false,
    includeInSchema: true,
  },
  {
    name: "Pro Plus",
    displayName: "Pro Plus",
    usd: "$59",
    gbp: "£44",
    schemaPriceUsd: 59,
    schemaPriceGbp: 44,
    originalUsd: "$120",
    originalGbp: "£90",
    subtitle: "For established teams with high quote volume",
    features: ["200 quotes", "5 GB storage", "100 AI Assist scan points", "All core features", "Priority support"],
    featured: false,
    comingSoon: false,
    isFree: false,
    includeInSchema: true,
  },
  {
    name: "Premium",
    displayName: "Premium",
    usd: "Contact Us",
    gbp: "Contact Us",
    schemaPriceUsd: 0,
    schemaPriceGbp: 0,
    originalUsd: null,
    originalGbp: null,
    subtitle: "Enterprise-level power for larger operations",
    features: ["Higher limits", "More users", "Advanced features", "Dedicated support"],
    featured: false,
    comingSoon: false,
    isFree: false,
    includeInSchema: false,
    contactUs: true,
  },
];

export const schemaPricingPlans = pricingPlans.filter((plan) => plan.includeInSchema);
