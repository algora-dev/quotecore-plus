import { notFound } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

import { AccountTabs, type AccountTabKey } from './AccountTabs';
import { UserProfileForm } from './UserProfileForm';
import { EmailChangeSection } from '@/app/(auth)/[workspaceSlug]/settings/EmailChangeSection';
import { CompanySettingsForm } from '@/app/(auth)/[workspaceSlug]/settings/CompanySettingsForm';
import { PasswordSection } from '@/app/(auth)/[workspaceSlug]/settings/PasswordSection';
import { MfaSection, RecoveryCodesPanel } from '@/app/(auth)/[workspaceSlug]/settings/MfaSection';
import { SecurityQuestionsSection } from '@/app/(auth)/[workspaceSlug]/settings/SecurityQuestionsSection';
import { AssistantSection } from '@/app/(auth)/[workspaceSlug]/settings/AssistantSection';
import { SupportSection } from './support/SupportSection';


import { loadCompanyTaxes } from '@/app/lib/taxes/actions';
import { listMfaFactors, getMfaRequired } from '@/app/(auth)/[workspaceSlug]/settings/mfa-actions';
import { getRecoveryCodeStatus } from '@/app/(auth)/[workspaceSlug]/settings/recovery-actions';
import { listSecurityQuestions } from '@/app/(auth)/[workspaceSlug]/settings/security-questions-actions';
import { BackButton } from '@/app/components/BackButton';
import { listMySupportTickets } from './support/actions';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { getStripeMode } from '@/app/lib/billing/stripe';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { BillingPanel, type BillingPlanInfo } from './billing/BillingPanel';

/**
 * Unified /account page.
 *
 * Everything Account-related now lives behind a single client-side tab
 * switcher. We load all the server data for every tab in ONE Promise.all
 * up front so tab switches are instant. Trade-off: this page's initial
 * load is slightly heavier than visiting a single subpage was, but every
 * subsequent tab switch is free.
 *
 * Deep linking: visit `/account?tab=security` to land on the Security tab.
 * The old subpath routes (/account/company, /account/security, etc.) are
 * preserved as redirect shims so external links still work.
 */
export default async function AccountPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // ONE parallel load for the whole section.
  const [
    userRes,
    authUserRes,
    companyRes,
    logoFileRes,
    taxes,
    mfa,
    mfaRequired,
    recoveryStatus,
    securityQuestions,
    supportTickets,
    entitlements,
    plansRes,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('full_name, email, email_notifications_enabled, assistant_enabled')
      .eq('id', profile.id)
      .single(),
    supabase.auth.getUser(),
    supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single(),
    supabase
      .from('quote_files')
      .select('storage_path')
      .eq('company_id', profile.company_id)
      .eq('file_type', 'logo')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadCompanyTaxes(),
    listMfaFactors(),
    getMfaRequired(),
    getRecoveryCodeStatus(),
    listSecurityQuestions(),
    listMySupportTickets(),
    loadCompanyEntitlements(profile.company_id),
    createAdminClient()
      .from('subscription_plans')
      .select('code, display_name, price_cents_monthly, price_cents_monthly_original, monthly_quote_limit, storage_limit_bytes, component_limit, flashing_limit, monthly_material_order_limit, monthly_invoice_limit, monthly_ai_tokens, included_seats, feat_digital_takeoff, feat_flashings, feat_material_orders, feat_followups, feat_email_send, feat_activity_card, feat_invoices, feat_message_center, tagline, feature_blurbs, coming_soon, stripe_price_id_live, stripe_price_id_test, sort_order, active')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const user = userRes.data;
  const authUser = authUserRes.data.user;
  const company = companyRes.data;
  if (companyRes.error || !company) notFound();

  const authProvider = authUser?.app_metadata?.provider || 'email';
  const userEmail = user?.email || authUser?.email || '';

  // Company logo URL. Public bucket, so a plain getPublicUrl is fine.
  let logoUrl: string | null = null;
  if (logoFileRes.data) {
    const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(logoFileRes.data.storage_path);
    logoUrl = urlData.publicUrl;
  }

  // Render each tab's panel once on the server, store in a map. The tab
  // switcher just toggles which one is visible \u2014 the data is already there.
  const panels: Record<AccountTabKey, React.ReactNode> = {
    profile: (
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
          <p className="text-sm text-slate-500 mt-1">Your personal account details.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <UserProfileForm
            userId={profile.id}
            currentFullName={user?.full_name ?? ''}
            currentEmail={userEmail}
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Sign-in email</h3>
            <p className="text-xs text-slate-500 mt-1">Change the email used to sign in. Both your old and new email must confirm the change.</p>
          </div>
          <EmailChangeSection currentEmail={userEmail} authProvider={authProvider} />
        </div>
      </section>
    ),

    company: (
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Company</h2>
          <p className="text-sm text-slate-500 mt-1">Settings that apply to your whole workspace.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-copilot="account-company">
          <CompanySettingsForm
            companyId={company.id}
            isOverStorage={entitlements.isOverStorage}
            userId={profile.id}
            currentCompanyName={company.name}
            currentUserName={user?.full_name || ''}
            currentCurrency={company.default_currency}
            currentLanguage={company.default_language}
            currentMeasurement={company.default_measurement_system}
            currentMaterialMargin={company.default_material_margin_percent || 0}
            currentLaborMargin={company.default_labor_margin_percent || 0}
            currentLogoUrl={logoUrl}
            currentDefaultTrade={(company as { default_trade?: string }).default_trade ?? 'roofing'}
            currentTaxes={taxes.map((t) => ({
              id: t.id,
              dbId: t.id,
              name: t.name,
              rate_percent: Number(t.rate_percent),
            }))}
          />
        </div>
      </section>
    ),

    security: (
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Security</h2>
          <p className="text-sm text-slate-500 mt-1">Protect access to your account.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-security">
          <PasswordSection authProvider={authProvider} userEmail={userEmail} />
          <MfaSection
            initialFactors={mfa.factors}
            currentAal={mfa.currentAal}
            initialMfaRequired={mfaRequired}
          />
          <RecoveryCodesPanel
            initialStatus={recoveryStatus}
            hasVerifiedMfa={mfa.factors.some((f) => f.status === 'verified')}
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-recovery">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Account Recovery</h3>
            <p className="text-sm text-slate-500 mt-1">
              Set questions only you can answer. Used by support to verify you if you ever lose access to your email.
            </p>
          </div>
          <SecurityQuestionsSection initialQuestions={securityQuestions} />
        </div>
      </section>
    ),

    notifications: (
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
          <p className="text-sm text-slate-500 mt-1">
            Email + in-app alerts are now configured per event in the Message
            Center. Open the inbox and choose the Settings tab to manage them.
          </p>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Chat Assistant</h3>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <AssistantSection
            initialEnabled={(user as { assistant_enabled?: boolean } | null)?.assistant_enabled ?? true}
          />
        </div>
      </section>
    ),

    billing: (() => {
      const stripeMode = getStripeMode();
      const priceColumn = stripeMode === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test';
      const allPlans = (plansRes.data ?? []) as Array<{
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
      // Tier-gating v3: render every active plan as a card. Trial is
      // always selectable (non-Stripe path); coming-soon tiers render
      // greyed-out and never invoke Stripe.
      // Pricing Tier v2 ladder: Free Trial / Free / Starter / Pro (+ higher
      // pro_plus and coming-soon premium). `growth` is deactivated and
      // intentionally excluded.
      const VISIBLE = new Set(['trial', 'free', 'starter', 'pro', 'pro_plus', 'premium']);
      const plans: BillingPlanInfo[] = allPlans
        .filter((p) => VISIBLE.has(p.code))
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
          hasStripePrice: Boolean(p[priceColumn]),
          isTrial: p.code === 'trial',
        }));

      // Whether the company has an active Stripe sub. Used to gate the
      // trial activation button so paying customers can't accidentally
      // downgrade themselves. A sub is treated as 'winding down' - and
      // therefore effectively gone for trial-activation purposes - when
      // EITHER cancel_at_period_end=true OR cancel_at is a future
      // timestamp. Both flags can be set by Stripe Dashboard cancel
      // flows (the portal sets cancel_at_period_end; some dashboard
      // paths set cancel_at instead).
      const cancelAt = (company as { cancel_at?: string | null }).cancel_at ?? null;
      const cancelAtInFuture = cancelAt != null && new Date(cancelAt).getTime() > Date.now();
      const hasActiveSubscription = Boolean(
        company.stripe_subscription_id
        && entitlements.subscriptionStatus !== 'canceled'
        && entitlements.subscriptionStatus !== 'suspended'
        && !company.cancel_at_period_end
        && !cancelAtInFuture,
      );

      return (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Billing &amp; Subscription</h2>
            <p className="text-sm text-slate-500 mt-1">Manage your plan and payment details.</p>
          </div>
          <div data-copilot="account-billing">
            <BillingPanel
              effectivePlanCode={entitlements.effectivePlanCode}
              purchasedPlanCode={entitlements.purchasedPlanCode}
              subscriptionStatus={entitlements.subscriptionStatus}
              hasStripeCustomer={Boolean(company.stripe_customer_id)}
              hasActiveSubscription={hasActiveSubscription}
              trialEndsAt={entitlements.trialEndsAt}
              currentPeriodEnd={entitlements.currentPeriodEnd}
              cancelAtPeriodEnd={Boolean(company.cancel_at_period_end)}
              cancelAt={cancelAt}
              firstPaymentFailureAt={entitlements.firstPaymentFailureAt}
              storageUsedBytes={entitlements.storageUsedBytes}
              storageLimitBytes={entitlements.storageLimitBytes}
              plans={plans}
            />
          </div>
        </section>
      );
    })(),

    support: <SupportSection initialTickets={supportTickets} />,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <BackButton />
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">Account</h1>
          <p className="text-slate-500 mt-1">Manage your account, company, security, and preferences.</p>
        </header>
        <AccountTabs panels={panels} />
      </div>
    </div>
  );
}
