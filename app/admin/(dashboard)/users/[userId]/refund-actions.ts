'use server';

/**
 * Admin refund actions (2026-10-20, owner request).
 * ================================================
 * Lists a company's refundable Stripe payments and issues full or partial
 * refunds from the admin panel.
 *
 * Locked rules:
 *  - Money only: a refund never cancels a subscription or restores usage
 *    (mirrors qcp_refund_observations: "Money movement is performed in
 *    Stripe; this table never restores QuoteCore+ usage").
 *  - The charge must belong to the target company's Stripe customer.
 *  - Free-text reason rides Stripe refund metadata + our admin audit row;
 *    Stripe's enum reason is set to requested_by_customer so the webhook
 *    observation records something meaningful.
 *  - Stripe errors (including restricted-key permission failures) surface
 *    verbatim so the dashboard fix is obvious.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe } from '@/app/lib/billing/stripe';
import { writeAudit } from '@/app/lib/admin/audit';

export interface RefundablePayment {
  chargeId: string;
  amountCents: number;
  refundedCents: number;
  remainingCents: number;
  currency: string;
  createdIso: string;
  description: string | null;
  invoiceId: string | null;
}

export type RefundPaymentsResult =
  | { ok: true; payments: RefundablePayment[] }
  | { ok: false; error: string };

export type RefundCreateResult =
  | { ok: true; refundId: string; amountCents: number; currency: string }
  | { ok: false; error: string };

type Loaded =
  | { error: string }
  | {
      user: { id: string; email: string | null };
      company: { id: string; name: string | null; customerId: string };
    };

async function loadUserAndCompany(userId: string): Promise<Loaded> {
  const admin = createAdminClient();
  const { data: user, error: userErr } = await admin
    .from('users')
    .select('id, email, company_id')
    .eq('id', userId)
    .maybeSingle();
  if (userErr || !user) return { error: 'User not found.' };
  if (!user.company_id) return { error: 'User has no company.' };

  const { data: company, error: coErr } = await admin
    .from('companies')
    .select('id, name, stripe_customer_id')
    .eq('id', user.company_id)
    .maybeSingle();
  if (coErr || !company) return { error: 'Company not found.' };

  const customerId = company.stripe_customer_id ?? '';
  if (!customerId.startsWith('cus_')) {
    return { error: 'This company has no Stripe payment history (admin grant, demo, or nothing paid yet).' };
  }
  return {
    user: { id: String(user.id), email: (user.email as string | null) ?? null },
    company: { id: String(company.id), name: (company.name as string | null) ?? null, customerId },
  };
}

function chargeInvoiceId(invoice: string | { id: string } | null): string | null {
  if (!invoice) return null;
  return typeof invoice === 'string' ? invoice : invoice.id;
}

export async function listCompanyPayments(userId: string): Promise<RefundPaymentsResult> {
  try {
    await requireAdmin();
    const loaded = await loadUserAndCompany(userId);
    if ('error' in loaded) return { ok: false, error: loaded.error };

    const stripe = requireStripe();
    const charges = await stripe.charges.list({ customer: loaded.company.customerId, limit: 20 });
    const payments: RefundablePayment[] = [];
    for (const charge of charges.data) {
      if (!charge.paid) continue;
      const refunded = charge.amount_refunded ?? 0;
      const remaining = charge.amount - refunded;
      if (remaining <= 0) continue;
      payments.push({
        chargeId: charge.id,
        amountCents: charge.amount,
        refundedCents: refunded,
        remainingCents: remaining,
        currency: charge.currency,
        createdIso: new Date(charge.created * 1000).toISOString(),
        description: charge.description ?? null,
        invoiceId: chargeInvoiceId(
          (charge as unknown as { invoice?: string | { id: string } | null }).invoice ?? null,
        ),
      });
    }
    return { ok: true, payments };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to list payments.' };
  }
}

export async function createAdminRefund(
  userId: string,
  input: { chargeId: string; amountCents: number | null; reason: string },
): Promise<RefundCreateResult> {
  try {
    const adminProfile = await requireAdmin();
    const loaded = await loadUserAndCompany(userId);
    if ('error' in loaded) return { ok: false, error: loaded.error };

    const stripe = requireStripe();
    const charge = await stripe.charges.retrieve(input.chargeId);
    const chargeCustomer =
      typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? '';
    if (chargeCustomer !== loaded.company.customerId) {
      return { ok: false, error: 'Payment does not belong to this company.' };
    }
    const refunded = charge.amount_refunded ?? 0;
    const remaining = charge.amount - refunded;
    if (remaining <= 0) return { ok: false, error: 'This payment is already fully refunded.' };

    const amount = input.amountCents == null ? remaining : Math.floor(input.amountCents);
    if (!Number.isFinite(amount) || amount < 1 || amount > remaining) {
      return {
        ok: false,
        error: `Refund amount must be between $0.01 and $${(remaining / 100).toFixed(2)}.`,
      };
    }
    const reason = input.reason.trim();
    if (reason.length < 3) return { ok: false, error: 'A reason is required.' };

    const refund = await stripe.refunds.create({
      charge: charge.id,
      amount,
      reason: 'requested_by_customer',
      metadata: {
        admin_reason: reason,
        admin_email: adminProfile.email,
        admin_user_id: adminProfile.id,
        source: 'qcp_admin_panel',
      },
    });

    const admin = createAdminClient();
    await writeAudit(
      admin,
      adminProfile,
      'admin_refund_created',
      loaded.company.id,
      loaded.user.id,
      loaded.user.email,
      loaded.company.name,
      reason,
      {
        charge_id: charge.id,
        refund_id: refund.id,
        amount_cents: amount,
        currency: charge.currency,
      },
    );

    return { ok: true, refundId: refund.id, amountCents: amount, currency: charge.currency };
  } catch (err) {
    // Verbatim: restricted-key permission failures read clearly here.
    return { ok: false, error: err instanceof Error ? err.message : 'Refund failed.' };
  }
}
