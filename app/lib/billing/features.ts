/**
 * Feature flag identifiers. Mirrors the columns on `subscription_plans` and
 * the CASE arms in the `public.company_has_feature(uuid, text)` SQL function.
 *
 * Adding a new feature is a three-step migration:
 *   1. ALTER TABLE subscription_plans ADD COLUMN feat_<name> boolean ...
 *   2. Update company_has_feature() to map <name> -> sp.feat_<name>
 *   3. Add the string here AND map it in FEATURE_LABELS / requiredPlanFor()
 */
export const FEATURES = [
  'digital_takeoff',
  'flashings',
  'material_orders',
  'followups',
  'email_send',
  'activity_card',
  'catalogs',
  'attachment_library',
  'invoices',
  'message_center',
] as const;

export type Feature = (typeof FEATURES)[number];

/**
 * Human-readable labels for UI rendering. The values should match the
 * marketing-page wording so users see consistent terminology between an
 * "Upgrade to unlock X" prompt and the pricing page.
 */
export const FEATURE_LABELS: Record<Feature, string> = {
  digital_takeoff: 'Digital takeoff',
  flashings: 'Flashing drawings & library',
  material_orders: 'Material orders',
  followups: 'Automated follow-ups',
  email_send: 'Send emails from QuoteCore+',
  activity_card: 'Activity card on quotes',
  catalogs: 'Catalog library',
  attachment_library: 'Attachment library',
  invoices: 'Invoices',
  message_center: 'Message Center',
};

/**
 * The cheapest plan code that includes each feature. Drives the "Upgrade
 * to <plan> to unlock <feature>" copy. Keep in sync with the seed rows in
 * the 2026-05-15 subscription tiers migration:
 *
 *   trial:  digital_takeoff, activity_card
 *   growth: digital_takeoff, email_send, activity_card (+ trial)
 *   pro:    digital_takeoff, flashings, material_orders, followups,
 *           email_send, activity_card
 *
 * Why this is a static map: the source of truth lives in DB rows, but for
 * "what plan should we tell the user to upgrade to?" we want a stable
 * client-renderable answer. If the seed rows change, update both.
 */
export const FEATURE_MIN_PLAN: Record<Feature, string> = {
  digital_takeoff: 'growth',
  flashings: 'pro',
  material_orders: 'pro',
  followups: 'pro',
  email_send: 'growth',
  activity_card: 'growth',
  catalogs: 'pro',
  attachment_library: 'pro',
  // Invoices + Message Center unlock at Starter (the entry paid tier).
  invoices: 'starter',
  message_center: 'starter',
};

/**
 * Defensive guard for unknown feature strings arriving from any boundary
 * (URLs, RPC error details, etc.). Keeps the type system honest.
 */
export function isFeature(value: unknown): value is Feature {
  return typeof value === 'string' && (FEATURES as readonly string[]).includes(value);
}
