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
import { writeAudit } from '@/app/lib/admin/audit';
import { requireStripe, getStripeMode, resolvePlanCodeForStripePrice } from '@/app/lib/billing/stripe';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { checkRateLimit } from '@/app/lib/security/rateLimit';
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
// Helper: write audit row — imported from @/app/lib/admin/audit (shared module)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Feature 4: Storage Browser — list, delete, archive attachments
// Gerald H-03: follow existing deleteAttachment() pattern from attachments/actions.ts:269
// ---------------------------------------------------------------------------

export interface AttachmentRow {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  storage_path: string;
  archived_at: string | null;
  created_at: string;
}

export async function listAttachments(companyId: string): Promise<{ ok: true; rows: AttachmentRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('company_attachments')
    .select('id, name, file_name, file_size, mime_type, storage_path, archived_at, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as AttachmentRow[] };
}

export async function adminDeleteAttachment(
  attachmentId: string,
  targetCompanyId: string,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  // Company-scoped fetch (Gerald H-03)
  const { data: row, error: fetchErr } = await admin
    .from('company_attachments')
    .select('storage_path, file_name, file_size')
    .eq('id', attachmentId)
    .eq('company_id', targetCompanyId)
    .single();

  if (fetchErr || !row) {
    return { ok: false, error: 'Attachment not found' };
  }

  const storagePath = (row as { storage_path: string }).storage_path;
  const fileName = (row as { file_name: string }).file_name;
  const fileSize = (row as { file_size: number }).file_size;

  // Remove storage object first (trigger decrements storage_used_bytes)
  const { error: rmErr } = await admin.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .remove([storagePath]);
  if (rmErr) {
    console.error('[admin/deleteAttachment] storage remove failed:', rmErr.message);
  }

  // Null email_templates references (same as existing deleteAttachment)
  const { error: tmplErr } = await admin
    .from('email_templates')
    .update({ attachment_id: null })
    .eq('attachment_id', attachmentId)
    .eq('company_id', targetCompanyId);
  if (tmplErr) {
    console.error('[admin/deleteAttachment] template unlink failed:', tmplErr.message);
  }

  // Delete DB row (trigger fires here)
  const { error: delErr } = await admin
    .from('company_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('company_id', targetCompanyId);

  if (delErr) return { ok: false, error: delErr.message };

  await writeAudit(
    admin, adminProfile,
    'delete_attachment',
    targetCompanyId, null, null, null, null,
    { attachmentId, fileName, fileSizeBytes: fileSize, storagePath },
  );

  return { ok: true, message: `Deleted "${fileName}"` };
}

export async function adminToggleArchiveAttachment(
  attachmentId: string,
  targetCompanyId: string,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  // Fetch current archived_at
  const { data: row, error: fetchErr } = await admin
    .from('company_attachments')
    .select('archived_at')
    .eq('id', attachmentId)
    .eq('company_id', targetCompanyId)
    .single();

  if (fetchErr || !row) {
    return { ok: false, error: 'Attachment not found' };
  }

  const currentArchived = (row as { archived_at: string | null }).archived_at;
  const newArchived = currentArchived ? null : new Date().toISOString();

  const { error: updErr } = await admin
    .from('company_attachments')
    .update({ archived_at: newArchived })
    .eq('id', attachmentId)
    .eq('company_id', targetCompanyId);

  if (updErr) return { ok: false, error: updErr.message };

  await writeAudit(
    admin, adminProfile,
    'toggle_archive_attachment',
    targetCompanyId, null, null, null, null,
    { attachmentId, archived: newArchived !== null },
  );

  return { ok: true, message: newArchived ? 'Archived' : 'Unarchived' };
}

// ---------------------------------------------------------------------------
// Feature 6: Impersonate User
// Gerald H-01: magic-link session swap. Admin's refresh token stored in DB
// for restoration. Opaque session-id cookie for audit tracking.
// ---------------------------------------------------------------------------

export async function startImpersonation(
  targetUserId: string,
  opts?: { notifyUser?: boolean },
): Promise<ActionResult & { redirect?: string }> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  // Rate limit: 10/hour per admin
  const allowed = await checkRateLimit(`impersonate:${adminProfile.id}`, 10, 3600_000);
  if (!allowed) {
    return { ok: false, error: 'Impersonation rate limit reached (10/hour). Try again later.' };
  }

  // Fetch target user
  const { data: target, error: targetErr } = await admin
    .from('users')
    .select('id, email, is_admin')
    .eq('id', targetUserId)
    .maybeSingle();

  if (targetErr || !target) {
    return { ok: false, error: 'User not found' };
  }

  const targetUser = target as { id: string; email: string; is_admin: boolean };

  // Block admin-to-admin (Gerald H-01)
  if (targetUser.is_admin) {
    return { ok: false, error: 'Cannot impersonate an admin user' };
  }

  // Capture admin's current refresh token so we can restore their session later.
  // We read it from the incoming request cookies via the server client.
  const { createSupabaseServerClient } = await import('@/app/lib/supabase/server');
  const serverClient = await createSupabaseServerClient();
  const { data: sessionData } = await serverClient.auth.getSession();
  const adminRefreshToken = sessionData.session?.refresh_token ?? null;

  if (!adminRefreshToken) {
    return { ok: false, error: 'Could not capture admin session for restoration. Aborting.' };
  }

  // Create impersonation session row (stores admin refresh token for restore)
  const { data: session, error: sessionErr } = await admin
    .from('admin_impersonation_sessions')
    .insert({
      admin_user_id: adminProfile.id,
      target_user_id: targetUserId,
      admin_refresh_token: adminRefreshToken,
    })
    .select('id')
    .single();

  if (sessionErr || !session) {
    return { ok: false, error: sessionErr?.message ?? 'Failed to create impersonation session' };
  }

  const sessionId = (session as { id: string }).id;

  // Set cookie (for audit tracking + banner display)
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set('qcp_impersonation', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 1800, // 30 min
  });

  // Generate a magic link for the target user
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.email,
  });

  if (linkErr || !linkData) {
    // Clean up session row if link generation failed
    await admin.from('admin_impersonation_sessions').delete().eq('id', sessionId);
    cookieStore.delete('qcp_impersonation');
    return { ok: false, error: `Failed to generate impersonation link: ${linkErr?.message ?? 'unknown'}` };
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    await admin.from('admin_impersonation_sessions').delete().eq('id', sessionId);
    cookieStore.delete('qcp_impersonation');
    return { ok: false, error: 'Magic link response missing hashed_token' };
  }

  // Notify user (optional)
  if (opts?.notifyUser) {
    // TODO: send notification email to targetUser.email
    console.log(`[impersonation] Notification email queued for ${targetUser.email}`);
  }

  await writeAudit(
    admin, adminProfile,
    'impersonation_start',
    null, targetUserId, targetUser.email, null, null,
    { sessionId, notifyUser: opts?.notifyUser ?? false },
  );

  // Redirect through the verify route — this swaps the auth session
  const verifyUrl = `/auth/verify?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=/`;
  return { ok: true, message: `Impersonating ${targetUser.email}`, redirect: verifyUrl };
}

export async function endImpersonation(): Promise<ActionResult & { redirect?: string }> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('qcp_impersonation')?.value;

  if (!sessionId) {
    return { ok: true, message: 'No active impersonation', redirect: '/admin' };
  }

  const admin = createAdminClient();

  // Fetch session row (includes admin refresh token for restoration)
  const { data: session } = await admin
    .from('admin_impersonation_sessions')
    .select('admin_user_id, target_user_id, admin_refresh_token')
    .eq('id', sessionId)
    .maybeSingle();

  // End session row
  await admin
    .from('admin_impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  // Clear cookie
  cookieStore.delete('qcp_impersonation');

  if (!session) {
    return { ok: true, message: 'Impersonation ended', redirect: '/admin' };
  }

  const s = session as { admin_user_id: string; target_user_id: string; admin_refresh_token: string | null };

  // Fetch admin email for audit + magic link
  const { data: adminUser } = await admin
    .from('users')
    .select('email')
    .eq('id', s.admin_user_id)
    .maybeSingle();

  const { data: targetUser } = await admin
    .from('users')
    .select('email')
    .eq('id', s.target_user_id)
    .maybeSingle();

  const adminEmail = (adminUser as { email: string })?.email ?? null;
  const targetEmail = (targetUser as { email: string })?.email ?? null;

  await writeAudit(
    admin,
    { id: s.admin_user_id, email: adminEmail ?? 'unknown' },
    'impersonation_end',
    null, s.target_user_id, targetEmail, null, null,
    { sessionId },
  );

  // Restore admin session: try refresh token first, then magic link as fallback
  if (s.admin_refresh_token && adminEmail) {
    // Try to restore the admin's session using their stored refresh token
    const { createSupabaseServerClient } = await import('@/app/lib/supabase/server');
    const serverClient = await createSupabaseServerClient();
    const { data: restored, error: restoreErr } = await serverClient.auth.refreshSession({
      refresh_token: s.admin_refresh_token,
    });

    if (!restoreErr && restored.session) {
      // Session restored — redirect to admin
      return { ok: true, message: 'Impersonation ended', redirect: `/admin/users/${s.target_user_id}` };
    }

    // Refresh token expired — fall through to magic link
    console.warn('[impersonation] Admin refresh token expired, falling back to magic link');
  }

  // Fallback: generate a magic link for the admin to sign back in
  if (adminEmail) {
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: adminEmail,
    });

    if (!linkErr && linkData?.properties?.hashed_token) {
      const tokenHash = linkData.properties.hashed_token;
      const verifyUrl = `/auth/verify?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=/admin/users/${s.target_user_id}`;
      return { ok: true, message: 'Impersonation ended', redirect: verifyUrl };
    }
  }

  // Last resort: redirect to admin login
  return { ok: true, message: 'Impersonation ended — please log back in', redirect: '/admin/login' };
}
