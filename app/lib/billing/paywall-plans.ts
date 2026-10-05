import { createAdminClient } from '@/app/lib/supabase/admin';
import { getStripeMode } from '@/app/lib/billing/stripe';
import type { BillingPlanInfo } from '@/app/(auth)/[workspaceSlug]/account/billing/BillingPanel';

/**
 * Load selectable subscription plans from the DB, mapped to the
 * BillingPanel card shape. Shared by the onboarding paywall page and the
 * account billing tab so both surfaces always render identical card data.
 *
 * `visible` controls which plan codes are returned (the account billing
 * tab shows a wider set incl. coming-soon tiers; the paywall shows only
 * the three purchasable tiers).
 */
export async function loadBillingPlans(
  visible: Set<string>,
): Promise<BillingPlanInfo[]> {
  const stripeMode = getStripeMode();
  const priceColumn = stripeMode === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test';

  const admin = createAdminClient();
  const { data: allPlans } = await admin
    .from('subscription_plans')
    .select('code, display_name, price_cents_monthly, price_cents_monthly_original, monthly_quote_limit, storage_limit_bytes, component_limit, flashing_limit, monthly_material_order_limit, monthly_invoice_limit, monthly_ai_tokens, ai_assist_points_limit, monthly_ai_parse_limit, included_seats, feat_digital_takeoff, feat_flashings, feat_material_orders, feat_followups, feat_email_send, feat_activity_card, feat_invoices, feat_message_center, tagline, feature_blurbs, coming_soon, stripe_price_id_live, stripe_price_id_test, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const rows = (allPlans ?? []) as Array<{
    code: string;
    display_name: string;
    price_cents_monthly: number;
    price_cents_monthly_original: number | null;
    monthly_quote_limit: number;
    storage_limit_bytes: number;
    component_limit: number | null;
    flashing_limit: number | null;
    monthly_material_order_limit: number | null;
    monthly_invoice_limit: number | null;
    monthly_ai_tokens: number | null;
    ai_assist_points_limit: number | null;
    monthly_ai_parse_limit: number | null;
    included_seats: number;
    feat_digital_takeoff: boolean;
    feat_flashings: boolean;
    feat_material_orders: boolean;
    feat_followups: boolean;
    feat_email_send: boolean;
    feat_activity_card: boolean;
    feat_invoices: boolean;
    feat_message_center: boolean;
    tagline: string | null;
    feature_blurbs: string[] | null;
    coming_soon: boolean;
    stripe_price_id_live: string | null;
    stripe_price_id_test: string | null;
    sort_order: number;
  }>;

  return rows
    .filter((p) => visible.has(p.code))
    .map((p) => ({
      code: p.code,
      displayName: p.display_name,
      sortOrder: p.sort_order,
      priceCentsMonthly: p.price_cents_monthly,
      priceCentsMonthlyOriginal: p.price_cents_monthly_original,
      monthlyQuoteLimit: p.monthly_quote_limit,
      storageLimitBytes: p.storage_limit_bytes,
      componentLimit: p.component_limit,
      flashingLimit: p.flashing_limit,
      monthlyMaterialOrderLimit: p.monthly_material_order_limit,
      monthlyInvoiceLimit: p.monthly_invoice_limit,
      monthlyAiTokens: p.monthly_ai_tokens,
      aiAssistPointsLimit: p.ai_assist_points_limit,
      monthlyAiParseLimit: p.monthly_ai_parse_limit,
      includedSeats: p.included_seats,
      features: {
        digital_takeoff: p.feat_digital_takeoff,
        flashings: p.feat_flashings,
        material_orders: p.feat_material_orders,
        followups: p.feat_followups,
        email_send: p.feat_email_send,
        activity_card: p.feat_activity_card,
        invoices: p.feat_invoices,
        message_center: p.feat_message_center,
      },
      tagline: p.tagline,
      featureBlurbs: p.feature_blurbs ?? [],
      comingSoon: p.coming_soon,
      hasStripePrice: Boolean(p[priceColumn as 'stripe_price_id_live' | 'stripe_price_id_test']),
    }));
}
