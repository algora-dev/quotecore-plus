'use server';

/**
 * Admin per-user profile actions.
 * ================================
 * All operations on a specific user/company from the admin profile page.
 * Gated behind requireAdmin(). Uses service-role client. Writes to
 * admin_actions with snapshots for audit.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe, getStripeMode, resolvePlanCodeForStripePrice } from '@/app/lib/billing/stripe';
import type Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserProfileData {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    isAdmin: boolean;
    createdAt: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string | null;
    planCode: string | null;
    subscriptionStatus: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodEnd: string | null;
    storageUsedBytes: number;
    storageLimitBytes: number | null;
    createdAt: string | null;
    adminPaused: boolean;
    adminPausedAt: string | null;
    adminPauseReason: string | null;
    adminOverridePlanCode: string | null;
    adminOverrideUntil: string | null;
    adminOverrideNotes: string | null;
  };
}

export type UserProfileResult =
  | { ok: true; data: UserProfileData }
  | { ok: false; error: string };

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export interface CouponInfo {
  id: string;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  name: string | null;
  valid: boolean;
}

// ---------------------------------------------------------------------------
// Helper: write audit row
// ---------------------------------------------------------------------------

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  adminProfile: { id: string; email: string },
  actionType: string,
  targetCompanyId: string | null,
  targetUserId: string | null,
  targetEmail: string | null,
  targetCompanyName: string | null,
  reason: string | null,
  details: Record<string, unknown> | null,
) {
  await admin.from('admin_actions').insert({
    admin_user_id: adminProfile.id,
    target_company_id: targetCompanyId,
    target_user_id: targetUserId,
    admin_email_snapshot: adminProfile.email,
    target_user_email_snapshot: targetEmail,
    target_company_name_snapshot: targetCompanyName,
    action_type: actionType,
    reason,
    details: details as never,
  });
}

// ---------------------------------------------------------------------------
// getUserProfile
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string): Promise<UserProfileResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: user, error: userErr } = await admin
    .from('users')
    .select('id, email, full_name, is_admin, company_id, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (userErr || !user) return { ok: false, error: 'User not found.' };
  if (!user.company_id) return { ok: false, error: 'User has no company.' };

  const { data: company, error: coErr } = await admin
    .from('companies')
    .select(`
      id, name, slug, plan_code, subscription_status,
      stripe_customer_id, stripe_subscription_id, stripe_price_id,
      current_period_end, storage_used_bytes, created_at,
      admin_paused, admin_paused_at, admin_pause_reason,
      admin_override_plan_code, admin_override_until, admin_override_notes
    `)
    .eq('id', user.company_id)
    .maybeSingle();
  if (coErr || !company) return { ok: false, error: 'Company not found.' };

  // Get storage limit from plan
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('storage_limit_bytes')
    .eq('code', company.plan_code ?? 'free')
    .maybeSingle();

  return {
    ok: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isAdmin: !!user.is_admin,
        createdAt: user.created_at,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        planCode: company.plan_code,
        subscriptionStatus: company.subscription_status,
        stripeCustomerId: company.stripe_customer_id,
        stripeSubscriptionId: company.stripe_subscription_id,
        stripePriceId: company.stripe_price_id,
        currentPeriodEnd: company.current_period_end,
        storageUsedBytes: company.storage_used_bytes,
        storageLimitBytes: plan?.storage_limit_bytes ?? null,
        createdAt: company.created_at,
        adminPaused: company.admin_paused,
        adminPausedAt: company.admin_paused_at,
        adminPauseReason: company.admin_pause_reason,
        adminOverridePlanCode: company.admin_override_plan_code,
        adminOverrideUntil: company.admin_override_until,
        adminOverrideNotes: company.admin_override_notes,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// updateCompanyName
// ---------------------------------------------------------------------------

export async function updateCompanyName(
  companyId: string,
  newName: string,
  reason: string,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };

  const { error } = await admin
    .from('companies')
    .update({ name: newName.trim() })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, adminProfile, 'update_company_name', companyId, null, null, company.name, reason, { oldName: company.name, newName: newName.trim() });

  return { ok: true, message: 'Company name updated.' };
}

// ---------------------------------------------------------------------------
// adminOverridePlan — free comp to any plan (no Stripe charge)
// ---------------------------------------------------------------------------

export async function adminOverridePlan(
  companyId: string,
  planCode: string,
  reason: string,
  durationDays: number = 365,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, plan_code')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };

  // Validate plan exists
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('code')
    .eq('code', planCode)
    .maybeSingle();
  if (!plan) return { ok: false, error: `Plan "${planCode}" does not exist.` };

  const until = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from('companies')
    .update({
      admin_override_plan_code: planCode,
      admin_override_until: until,
      admin_override_notes: reason,
    })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, adminProfile, 'admin_override_plan', companyId, null, null, company.name, reason, { planCode, durationDays, until });

  return { ok: true, message: `Override set to ${planCode} for ${durationDays} days.` };
}

// ---------------------------------------------------------------------------
// changePaidPlan — swap Stripe subscription price
// ---------------------------------------------------------------------------

export async function changePaidPlan(
  companyId: string,
  targetPlanCode: string,
  reason: string,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, plan_code, stripe_subscription_id, stripe_mode')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };
  if (!company.stripe_subscription_id) return { ok: false, error: 'Company has no Stripe subscription.' };

  // Resolve the Stripe Price ID for the target plan in the current mode
  const mode = getStripeMode();
  const priceCol = mode === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: planRow } = await (admin as any)
    .from('subscription_plans')
    .select(`code, ${priceCol}`)
    .eq('code', targetPlanCode)
    .maybeSingle();
  if (!planRow) return { ok: false, error: `Plan "${targetPlanCode}" not found.` };
  const newPriceId = planRow[priceCol];
  if (!newPriceId) return { ok: false, error: `Plan "${targetPlanCode}" has no ${mode} Stripe Price ID.` };

  const stripe = requireStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
    const itemId = sub.items.data[0]?.id;
    if (!itemId) return { ok: false, error: 'Subscription has no items.' };

    await stripe.subscriptions.update(company.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });
  } catch (err) {
    return { ok: false, error: `Stripe error: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Clear any active override since we're setting a real paid plan
  const update: Record<string, unknown> = {
    plan_code: targetPlanCode,
    stripe_price_id: newPriceId,
    admin_override_plan_code: null,
    admin_override_until: null,
    admin_override_notes: null,
  };

  const { error } = await admin.from('companies').update(update).eq('id', companyId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, adminProfile, 'change_paid_plan', companyId, null, null, company.name, reason, { fromPlan: company.plan_code, toPlan: targetPlanCode, priceId: newPriceId });

  return { ok: true, message: `Plan changed to ${targetPlanCode}. Stripe subscription updated.` };
}

// ---------------------------------------------------------------------------
// removeOverride
// ---------------------------------------------------------------------------

export async function removeOverride(companyId: string, reason: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, admin_override_plan_code')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };

  const { error } = await admin
    .from('companies')
    .update({
      admin_override_plan_code: null,
      admin_override_until: null,
      admin_override_notes: null,
    })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, adminProfile, 'remove_override', companyId, null, null, company.name, reason, { removedOverride: company.admin_override_plan_code });

  return { ok: true, message: 'Admin override removed.' };
}

// ---------------------------------------------------------------------------
// listAvailableCoupons
// ---------------------------------------------------------------------------

export async function listAvailableCoupons(): Promise<{ ok: true; coupons: CouponInfo[] } | { ok: false; error: string }> {
  await requireAdmin();
  const stripe = requireStripe();

  try {
    const list = await stripe.coupons.list({ limit: 100 });
    const coupons: CouponInfo[] = (list.data as Stripe.Coupon[])
      .filter((c) => c.valid && c.metadata?.quotecore_admin_visible === 'true')
      .map((c) => ({
        id: c.id,
        percentOff: c.percent_off,
        amountOff: c.amount_off,
        duration: c.duration,
        name: c.name,
        valid: c.valid,
      }));
    return { ok: true, coupons };
  } catch (err) {
    return { ok: false, error: `Stripe error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// getCurrentCoupon
// ---------------------------------------------------------------------------

export async function getCurrentCoupon(companyId: string): Promise<{ ok: true; coupon: CouponInfo | null } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('stripe_subscription_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };
  if (!company.stripe_subscription_id) return { ok: true, coupon: null };

  const stripe = requireStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
    // Stripe API: discounts is an array of Discount objects
    const discounts = (sub as unknown as { discounts?: Array<{ coupon?: Stripe.Coupon }> }).discounts;
    const coupon = discounts?.[0]?.coupon;
    if (!coupon) return { ok: true, coupon: null };
    const c = coupon as Stripe.Coupon;
    return {
      ok: true,
      coupon: {
        id: c.id,
        percentOff: c.percent_off,
        amountOff: c.amount_off,
        duration: c.duration,
        name: c.name,
        valid: c.valid,
      },
    };
  } catch (err) {
    return { ok: false, error: `Stripe error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// applyCoupon
// ---------------------------------------------------------------------------

export async function applyCoupon(companyId: string, couponId: string, reason: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, stripe_subscription_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };
  if (!company.stripe_subscription_id) return { ok: false, error: 'Company has no Stripe subscription.' };

  const stripe = requireStripe();
  try {
    await stripe.subscriptions.update(company.stripe_subscription_id, {
      discounts: [{ coupon: couponId }],
    });
  } catch (err) {
    return { ok: false, error: `Stripe error: ${err instanceof Error ? err.message : String(err)}` };
  }

  await writeAudit(admin, adminProfile, 'apply_coupon', companyId, null, null, company.name, reason, { couponId });

  return { ok: true, message: 'Coupon applied.' };
}

// ---------------------------------------------------------------------------
// removeCoupon
// ---------------------------------------------------------------------------

export async function removeCoupon(companyId: string, reason: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, stripe_subscription_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };
  if (!company.stripe_subscription_id) return { ok: false, error: 'Company has no Stripe subscription.' };

  const stripe = requireStripe();
  try {
    // Empty string clears all discounts (Gerald v2 M-01: empty array does nothing)
    await stripe.subscriptions.update(company.stripe_subscription_id, {
      discounts: '',
    });
  } catch (err) {
    return { ok: false, error: `Stripe error: ${err instanceof Error ? err.message : String(err)}` };
  }

  await writeAudit(admin, adminProfile, 'remove_coupon', companyId, null, null, company.name, reason, null);

  return { ok: true, message: 'Coupon removed.' };
}

// ---------------------------------------------------------------------------
// pauseAccess
// ---------------------------------------------------------------------------

export async function pauseAccess(companyId: string, reason: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };

  // Self-protection: don't let admin pause own company
  const { data: users } = await admin
    .from('users')
    .select('id')
    .eq('company_id', companyId);
  if ((users ?? []).some((u) => u.id === adminProfile.id)) {
    return { ok: false, error: 'You cannot pause your own account.' };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('companies')
    .update({
      admin_paused: true,
      admin_paused_at: now,
      admin_paused_by: adminProfile.id,
      admin_pause_reason: reason,
    })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, adminProfile, 'pause_access', companyId, null, null, company.name, reason, { pausedAt: now });

  return { ok: true, message: 'Access paused. User is locked out.' };
}

// ---------------------------------------------------------------------------
// resumeAccess — mandatory Stripe sync before clearing pause
// ---------------------------------------------------------------------------

export async function resumeAccess(companyId: string, reason: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, stripe_subscription_id, stripe_customer_id')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found.' };

  // Mandatory: full Stripe reconciliation before clearing pause.
  // If Stripe fails, stay paused.
  if (company.stripe_subscription_id) {
    const stripe = requireStripe();
    try {
      const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
      const priceId = sub.items.data[0]?.price?.id;
      const planCode = priceId ? await resolvePlanCodeForStripePrice(priceId) : null;

      const periodEndSeconds = sub.items.data[0]?.current_period_end;
      const currentPeriodEnd = periodEndSeconds
        ? new Date(periodEndSeconds * 1000).toISOString()
        : null;

      // Sync DB with Stripe truth
      const update: Record<string, unknown> = {
        admin_paused: false,
        admin_paused_at: null,
        admin_paused_by: null,
        admin_pause_reason: null,
        subscription_status: sub.status === 'canceled' ? 'canceled' : (sub.status === 'active' ? 'active' : undefined),
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        first_payment_failure_at: null,
        dunning_stage_entered_at: null,
      };
      if (planCode) {
        update.plan_code = planCode;
        update.stripe_price_id = priceId;
      }
      // Remove undefined values
      Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

      const { error } = await admin.from('companies').update(update).eq('id', companyId);
      if (error) return { ok: false, error: `DB sync failed: ${error.message}` };

      await writeAudit(admin, adminProfile, 'resume_access', companyId, null, null, company.name, reason, { syncedPlan: planCode, syncedStatus: update.subscription_status ?? 'unchanged' });

      return { ok: true, message: 'Access resumed. Stripe data synced.' };
    } catch (err) {
      // Stripe unreachable — stay paused for safety
      return { ok: false, error: `Cannot reach Stripe to sync. Staying paused for safety: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // No Stripe subscription — just clear pause
  const { error } = await admin
    .from('companies')
    .update({
      admin_paused: false,
      admin_paused_at: null,
      admin_paused_by: null,
      admin_pause_reason: null,
    })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };

  await writeAudit(admin, adminProfile, 'resume_access', companyId, null, null, company.name, reason, { noSubscription: true });

  return { ok: true, message: 'Access resumed.' };
}

// ---------------------------------------------------------------------------
// sendPasswordReset — send email via Supabase mailer, never return URL
// ---------------------------------------------------------------------------

export async function sendPasswordReset(userId: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  const { data: user } = await admin
    .from('users')
    .select('id, email, company_id')
    .eq('id', userId)
    .maybeSingle();
  if (!user) return { ok: false, error: 'User not found.' };

  const { data: company } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', user.company_id)
    .maybeSingle();

  try {
    // generateLink creates a recovery link. We DO NOT return it to the client.
    // Supabase mailer sends it directly to the user's email.
    const { error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });
    if (error) {
      return { ok: false, error: `Failed to send reset email: ${error.message}` };
    }
  } catch (err) {
    return { ok: false, error: `Failed to send reset email: ${err instanceof Error ? err.message : String(err)}` };
  }

  await writeAudit(admin, adminProfile, 'send_password_reset', company?.id ?? null, user.id, user.email, company?.name ?? null, null, null);

  return { ok: true, message: `Reset email sent to ${user.email}.` };
}

// ---------------------------------------------------------------------------
// deleteAccount — moved from users/actions.ts, with audit pre-write
// ---------------------------------------------------------------------------

const STORAGE_BUCKETS = ['company-logos', 'QUOTE-DOCUMENTS'] as const;

async function listCompanyStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  companyId: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data: top } = await admin.storage.from(bucket).list(companyId, { limit: 1000 });
  for (const entry of top ?? []) {
    if (entry.id === null) {
      const sub = `${companyId}/${entry.name}`;
      const { data: subFiles } = await admin.storage.from(bucket).list(sub, { limit: 1000 });
      for (const f of subFiles ?? []) {
        if (f.id !== null) paths.push(`${sub}/${f.name}`);
      }
    } else {
      paths.push(`${companyId}/${entry.name}`);
    }
  }
  return paths;
}

export async function deleteAccount(companyId: string, confirmEmail: string): Promise<ActionResult> {
  const adminProfile = await requireAdmin();

  if (!companyId) return { ok: false, error: 'Missing company id.' };
  const typed = (confirmEmail ?? '').trim().toLowerCase();
  if (!typed) return { ok: false, error: 'Type the account email to confirm.' };

  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return { ok: false, error: 'Company not found (already deleted?).' };

  const { data: users } = await admin
    .from('users')
    .select('id, email, company_id')
    .eq('company_id', companyId);
  const userList = users ?? [];

  // Self-protection
  if (userList.some((u) => u.id === adminProfile.id)) {
    return { ok: false, error: 'You cannot delete your own account from here.' };
  }

  // Typed-confirmation
  const emails = userList.map((u) => (u.email ?? '').toLowerCase());
  if (!emails.includes(typed)) {
    return { ok: false, error: 'Confirmation email does not match a user on this account.' };
  }

  // Write audit BEFORE deletion (FKs are ON DELETE SET NULL so row survives)
  await writeAudit(admin, adminProfile, 'delete_account', companyId, userList[0]?.id ?? null, userList[0]?.email ?? null, company.name, `Confirmed with email: ${typed}`, { userCount: userList.length });

  // 1. Storage
  let storageRemoved = 0;
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const paths = await listCompanyStoragePaths(admin, bucket, companyId);
      if (paths.length > 0) {
        for (let i = 0; i < paths.length; i += 100) {
          const chunk = paths.slice(i, i + 100);
          const { error } = await admin.storage.from(bucket).remove(chunk);
          if (!error) storageRemoved += chunk.length;
        }
      }
    } catch { /* best-effort */ }
  }

  // 2. Auth users
  let authDeleted = 0;
  for (const u of userList) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (!error || /not found/i.test(error.message)) authDeleted += 1;
  }

  // 3. Company row (cascades everything)
  const { error: delErr } = await admin.from('companies').delete().eq('id', companyId);
  if (delErr) {
    return { ok: false, error: `Partial deletion. Storage + auth removed but company row failed: ${delErr.message}` };
  }

  console.log(
    `[admin/delete-account] WIPED company=${companyId} (${company.name}) ` +
      `users=${authDeleted} storageObjects=${storageRemoved} ` +
      `by admin=${adminProfile.id} (${adminProfile.email})`,
  );

  return { ok: true, message: `Deleted "${company.name}" — ${authDeleted} login(s), ${storageRemoved} file(s), and all company data.` };
}
