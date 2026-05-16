import { notFound } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';

import { AccountTabs, type AccountTabKey } from './AccountTabs';
import { UserProfileForm } from './UserProfileForm';
import { EmailChangeSection } from '@/app/(auth)/[workspaceSlug]/settings/EmailChangeSection';
import { CompanySettingsForm } from '@/app/(auth)/[workspaceSlug]/settings/CompanySettingsForm';
import { PasswordSection } from '@/app/(auth)/[workspaceSlug]/settings/PasswordSection';
import { MfaSection, RecoveryCodesPanel } from '@/app/(auth)/[workspaceSlug]/settings/MfaSection';
import { SecurityQuestionsSection } from '@/app/(auth)/[workspaceSlug]/settings/SecurityQuestionsSection';
import { NotificationsSection } from '@/app/(auth)/[workspaceSlug]/settings/NotificationsSection';
import { CopilotSettings } from '@/app/(auth)/[workspaceSlug]/settings/CopilotSettings';
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
      .select('full_name, email, email_notifications_enabled')
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
      .select('code, display_name, price_cents_monthly, monthly_quote_limit, storage_limit_bytes, stripe_price_id_live, stripe_price_id_test, sort_order, active')
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
            userId={profile.id}
            currentCompanyName={company.name}
            currentUserName={user?.full_name || ''}
            currentCurrency={company.default_currency}
            currentLanguage={company.default_language}
            currentMeasurement={company.default_measurement_system}
            currentMaterialMargin={company.default_material_margin_percent || 0}
            currentLaborMargin={company.default_labor_margin_percent || 0}
            currentLogoUrl={logoUrl}
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
          <p className="text-sm text-slate-500 mt-1">Decide which app alerts also reach your inbox, and how Copilot guides you.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-notifications">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Email alerts</h3>
          </div>
          <NotificationsSection
            initialEnabled={user?.email_notifications_enabled ?? true}
            userEmail={userEmail}
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" data-copilot="account-copilot">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Copilot</h3>
            <p className="text-sm text-slate-500 mt-1">Interactive tutorials that guide you through each feature.</p>
          </div>
          <CopilotSettings />
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
        monthly_quote_limit: number;
        storage_limit_bytes: number;
        stripe_price_id_live: string | null;
        stripe_price_id_test: string | null;
        sort_order: number;
      }>;
      // Phase 1: only show trial/starter/growth/pro in the upgrade UI. Higher
      // tiers exist in the DB but aren't user-pickable yet.
      const PHASE_1_VISIBLE = new Set(['starter', 'growth', 'pro']);
      const upgradePlans: BillingPlanInfo[] = allPlans
        .filter((p) => p.code !== entitlements.purchasedPlanCode && PHASE_1_VISIBLE.has(p.code))
        .map((p) => ({
          code: p.code,
          displayName: p.display_name,
          priceCentsMonthly: p.price_cents_monthly,
          monthlyQuoteLimit: p.monthly_quote_limit,
          storageLimitBytes: p.storage_limit_bytes,
          hasStripePrice: Boolean(p[priceColumn]),
        }));

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
              trialEndsAt={entitlements.trialEndsAt}
              currentPeriodEnd={entitlements.currentPeriodEnd}
              firstPaymentFailureAt={entitlements.firstPaymentFailureAt}
              storageUsedBytes={entitlements.storageUsedBytes}
              storageLimitBytes={entitlements.storageLimitBytes}
              upgradePlans={upgradePlans}
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
