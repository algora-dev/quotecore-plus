/** Existing custom-subscriber setup changes (2026-10-11, owner request):
 * re-run the pricing calculator in Billing, swap the Stripe subscription
 * items with proration, and apply the new selection truthfully. New-customer
 * checkout stays in checkout.ts; nothing here mints a second subscription. */
import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireStripe } from '@/app/lib/billing/stripe';
import { PREVIEW_CATALOG } from '@/app/components/pricing/calculator/calculatorConfig';
import { buildBillingCatalogue, buildSubscriptionItemChanges } from '@/app/components/pricing/calculator/billingCatalogue';
import { expandValidatedSetup } from './checkout';
import { fetchAllSubscriptionItems, fetchFullSubscriptionItems } from './reconcile';
import { BillingContractError, decodeRegisteredItems, insist, referenceId, requireMode } from './contracts';
import { customScope, requireCustomCheckoutEnabled, verifyCustomAccount } from './environment';
import { loadCustomPriceMap, loadRecognitionRegistry } from './registry';

export { customScope };

export type CustomChangePreview =
    | { ok: true; direction: 'upgrade' | 'downgrade'; currentMonthlyCents: number; newMonthlyCents: number; proratedTodayCents: number; periodEndIso: string; newRows: { productName: string; monthlyCents: number }[] }
    | { ok: false; code: string; message: string };
export type CustomChangeResult =
    | { ok: true; result: string; newMonthlyCents: number; proratedTodayCents: number }
    | { ok: false; code: string; message: string };

const MESSAGES: Record<string, string> = {
    change_not_available: 'Changing your setup is not available yet. Nothing was changed.',
    no_subscription: 'No active custom subscription was found for this workspace.',
    change_pending: 'A previous change is still settling. Try again in a moment.',
    unchanged: 'You are already on this exact setup. Nothing to change.',
    catalog_changed: 'The catalogue changed. Review your setup again before confirming.',
    setup_expired: 'Your saved setup expired. Review your choices again.',
    setup_invalid: 'Your saved setup could not be verified. Review your choices again.',
    items_incomplete: 'Your subscription items could not be read completely. Nothing was changed.',
    change_verification_failed: 'The provider did not confirm the new setup. Our team will review it; no second charge was made.',
    company_mode_mismatch: 'This billing account belongs to a different environment. Contact our team.',
};
function publicFailure(error: unknown): { ok: false; code: string; message: string } {
    const code = error instanceof BillingContractError ? error.code : 'change_retry_required';
    return { ok: false, code, message: MESSAGES[code] ?? 'The change could not be confirmed. Please retry the same setup.' };
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));

/** Estimated proration for display only. Stripe invoices the exact amount. */
function estimateProration(currentMonthlyCents: number, newMonthlyCents: number, periodStartIso: string, periodEndIso: string, now = Date.now()) {
    const start = Date.parse(periodStartIso), end = Date.parse(periodEndIso);
    const span = Math.max(1, end - start);
    const remaining = Math.min(1, Math.max(0, (end - now) / span));
    const delta = newMonthlyCents - currentMonthlyCents;
    return Math.round(delta * remaining);
}

export async function previewCustomSetupChange(opts: { rawSetup: string; companyId: string }): Promise<CustomChangePreview> {
    try {
        requireCustomCheckoutEnabled();
        const scope = await verifyCustomAccount();
        const stripe = requireStripe();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = createAdminClient() as any;
        const { data: company, error } = await admin.from('companies')
            .select('id, billing_model, stripe_mode, stripe_subscription_id, stripe_customer_id, admin_paused')
            .eq('id', opts.companyId).maybeSingle();
        if (error) throw new Error(`retryable: company read: ${error.message}`);
        insist(company && !company.admin_paused, 'company_unavailable');
        insist(company.billing_model === 'custom_setup' && company.stripe_subscription_id && company.stripe_customer_id, 'no_subscription');
        insist(!company.stripe_mode || company.stripe_mode === scope.mode, 'company_mode_mismatch');
        const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        requireMode(subscription, scope.mode);
        insist(['active', 'trialing'].includes(subscription.status), 'no_subscription');
        insist(!subscription.pending_update, 'change_pending');
        const { data: snapshot } = await admin.from('company_custom_billing')
            .select('period_start, period_end, monthly_cents')
            .eq('company_id', opts.companyId).maybeSingle();
        const expanded = await expandValidatedSetup(opts.rawSetup);
        const { data: currentCodes } = await admin.from('company_custom_billing')
            .select('component_codes').eq('company_id', opts.companyId).maybeSingle();
        const currentCodeList: string[] = Array.isArray(currentCodes?.component_codes) ? currentCodes.component_codes : [];
        if (sameSet(currentCodeList, expanded.selection.map(r => r.code)))
            return { ok: false, code: 'unchanged', message: MESSAGES.unchanged };
        const currentMonthly = snapshot?.monthly_cents ?? 0;
        const prorated = estimateProration(currentMonthly, expanded.monthlyCents, snapshot?.period_start ?? new Date().toISOString(), snapshot?.period_end ?? new Date(Date.now() + 30 * 86400000).toISOString());
        return {
            ok: true,
            direction: expanded.monthlyCents >= currentMonthly ? 'upgrade' : 'downgrade',
            currentMonthlyCents: currentMonthly,
            newMonthlyCents: expanded.monthlyCents,
            proratedTodayCents: prorated,
            periodEndIso: snapshot?.period_end ?? '',
            newRows: expanded.selection.map(r => ({ productName: r.productName, monthlyCents: r.monthlyCents })),
        };
    } catch (error) {
        console.error('[billing/custom] preview stopped:', error instanceof Error ? error.message : 'unknown');
        return publicFailure(error);
    }
}

export async function changeCustomSetup(opts: { rawSetup: string; companyId: string; userId: string | null }): Promise<CustomChangeResult> {
    try {
        requireCustomCheckoutEnabled();
        const scope = await verifyCustomAccount();
        const stripe = requireStripe();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = createAdminClient() as any;
        const { data: company, error } = await admin.from('companies')
            .select('id, billing_model, stripe_mode, stripe_subscription_id, stripe_customer_id, admin_paused')
            .eq('id', opts.companyId).maybeSingle();
        if (error) throw new Error(`retryable: company read: ${error.message}`);
        insist(company && !company.admin_paused, 'company_unavailable');
        insist(company.billing_model === 'custom_setup' && company.stripe_subscription_id && company.stripe_customer_id, 'no_subscription');
        insist(!company.stripe_mode || company.stripe_mode === scope.mode, 'company_mode_mismatch');
        const subscription = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        requireMode(subscription, scope.mode);
        insist(referenceId(subscription.customer) === company.stripe_customer_id, 'subscription_ownership_mismatch');
        insist(['active', 'trialing'].includes(subscription.status), 'no_subscription');
        insist(!subscription.pending_update, 'change_pending');
        const { data: snapshot } = await admin.from('company_custom_billing')
            .select('period_start, period_end, monthly_cents, component_codes')
            .eq('company_id', opts.companyId).maybeSingle();
        const expanded = await expandValidatedSetup(opts.rawSetup);
        const currentCodeList: string[] = Array.isArray(snapshot?.component_codes) ? snapshot.component_codes : [];
        insist(!sameSet(currentCodeList, expanded.selection.map(r => r.code)), 'unchanged');
        const complete = await fetchAllSubscriptionItems(stripe, company.stripe_subscription_id);
        insist(complete.complete, 'items_incomplete');
        const priceMap = Object.fromEntries(await loadCustomPriceMap());
        const changes = buildSubscriptionItemChanges(complete, expanded.intent, PREVIEW_CATALOG, priceMap);
        insist(Array.isArray(changes) && changes.length > 0, 'setup_invalid');
        const currentMonthly = snapshot?.monthly_cents ?? 0;
        const prorated = estimateProration(currentMonthly, expanded.monthlyCents, snapshot?.period_start ?? new Date().toISOString(), snapshot?.period_end ?? new Date(Date.now() + 30 * 86400000).toISOString());
        // One atomic provider call: swap items, invoice the prorated difference now,
        // and never finalize an upgrade whose payment cannot complete.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await stripe.subscriptions.update(company.stripe_subscription_id, {
            items: changes as never,
            proration_behavior: 'always_invoice',
            payment_behavior: 'pending_if_incomplete',
        }, { idempotencyKey: `custom-change-${company.id}-${expanded.operationKey}` });
        // Post-update truth: read back the COMPLETE item set and decode it exactly
        // like the webhook does, then apply the new selection with an unchanged period.
        const finalSub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        insist(['active', 'trialing'].includes(finalSub.status), 'no_subscription');
        const finalItems = await fetchFullSubscriptionItems(stripe, company.stripe_subscription_id);
        const rows = await loadRecognitionRegistry(scope);
        const purchase = decodeRegisteredItems(finalItems, finalSub, rows, buildBillingCatalogue(PREVIEW_CATALOG));
        insist(sameSet(purchase.codes, expanded.selection.map(r => r.code)), 'change_verification_failed');
        const begin = await admin.rpc('qcp_begin_custom_reconcile', { p_company_id: company.id, p_mode: scope.mode });
        if (begin.error) throw new Error(`retryable: change ticket: ${begin.error.message}`);
        insist(typeof begin.data === 'number' && Number.isSafeInteger(begin.data), 'reconciliation_ticket_invalid');
        const payload = {
            kind: 'change', stripe_account_id: scope.accountId, stripe_mode: scope.mode,
            stripe_customer_id: company.stripe_customer_id, stripe_subscription_id: company.stripe_subscription_id,
            provider_status: finalSub.status, catalog_id: scope.catalogId, catalog_revision: purchase.revision ?? scope.revision,
            component_codes: purchase.codes, purchased_entitlements: purchase.limits,
            currency: scope.currency.toLowerCase(), monthly_cents: purchase.monthlyCents,
        };
        const eventId = `manual_change_${company.stripe_subscription_id}_${Date.now()}`;
        const event = { id: eventId, type: 'custom_billing.manual_change', created: Math.floor(Date.now() / 1000) };
        const applied = await admin.rpc('qcp_apply_custom_reconcile', {
            p_company_id: company.id, p_fence: begin.data,
            p_payload: JSON.parse(JSON.stringify(payload)), p_event: event,
        });
        if (applied.error) throw new Error(`retryable: change reconciliation: ${applied.error.message}`);
        insist(typeof applied.data === 'string', 'reconciliation_result_invalid');
        return { ok: true, result: applied.data, newMonthlyCents: purchase.monthlyCents, proratedTodayCents: prorated };
    } catch (error) {
        console.error('[billing/custom] change stopped:', error instanceof Error ? error.message : 'unknown');
        return publicFailure(error);
    }
}
