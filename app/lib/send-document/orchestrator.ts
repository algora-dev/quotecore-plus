'use server';

/**
 * Unified send-document orchestrator.
 *
 * Replaces sendQuoteMessage / sendOrderMessage / sendInvoiceMessage with
 * a single server action that dispatches to a per-entity adapter.
 *
 * The shared pipeline (sendOutboundMessage in app/lib/messages/send.ts)
 * is NOT modified — adapters produce the inputs it expects.
 */

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendOutboundMessage } from '@/app/lib/messages/send';
import {
  assertCanSendMessage,
  FeatureGatedError,
  SubscriptionInactiveError,
  FEATURE_LABELS,
} from '@/app/lib/billing/entitlements';
import { getSiteUrl } from '@/app/lib/email/urls';

import type { SendDocumentInput, SendDocumentResult, DocumentSendAdapter } from './types';
import { invoiceAdapter } from './adapters/invoice';
import { orderAdapter, ensureOrderSupplierToken } from './adapters/order';
import { quoteAdapter, ensureQuoteAcceptanceToken, computeQuoteTotalForMerge } from './adapters/quote';

const ADAPTERS: Record<string, DocumentSendAdapter> = {
  invoice: invoiceAdapter,
  order: orderAdapter,
  quote: quoteAdapter,
};

export async function sendDocumentMessage(
  input: SendDocumentInput,
): Promise<SendDocumentResult> {
  const adapter = ADAPTERS[input.entityKind];
  if (!adapter) {
    return { ok: false, error: `Unknown entity kind: ${input.entityKind}` };
  }

  const profile = await requireCompanyContext();

  // ─── 1. Shared entitlement gate ───
  try {
    await assertCanSendMessage(profile.company_id, 'manual');
    await adapter.extraEntitlements?.(profile.company_id);
  } catch (gateErr) {
    if (gateErr instanceof FeatureGatedError) {
      return {
        ok: false,
        error: `${FEATURE_LABELS[gateErr.feature]} isn't included in your current plan. Upgrade to send directly from QuoteCore+, or copy the public link and email it yourself.`,
        gated: true,
      };
    }
    if (gateErr instanceof SubscriptionInactiveError) {
      return {
        ok: false,
        error: 'Your subscription is not active. Reactivate to send messages.',
      };
    }
    throw gateErr;
  }

  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();

  // ─── 2. Load entity (ownership-scoped) ───
  const entity = await adapter.loadEntity(supabase, profile.company_id, input.entityId);
  if (!entity) {
    return { ok: false, error: `${input.entityKind.charAt(0).toUpperCase() + input.entityKind.slice(1)} not found.` };
  }

  // ─── 3. Validate sendable state ───
  const sendableError = adapter.validateSendable?.(entity);
  if (sendableError) {
    return { ok: false, error: sendableError };
  }

  // ─── 4. Resolve token ───
  let token = await adapter.resolveToken(entity, profile.company_id);

  // Orders need special handling: mint token if none exists.
  if (input.entityKind === 'order' && !token) {
    token = await ensureOrderSupplierToken(supabase, input.entityId, profile.company_id);
  }

  // Quotes: mint a new token if none exists and the quote is sendable.
  if (input.entityKind === 'quote' && !token) {
    const quote = entity as unknown as { accepted_at: string | null; declined_at: string | null; status: string };
    if (!quote.accepted_at && !quote.declined_at && quote.status !== 'draft') {
      token = await ensureQuoteAcceptanceToken(supabase, input.entityId, profile.company_id);
    }
  }

  // ─── 5. Load company row (name, currency) ───
  const { data: company } = await supabase
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();

  const fallbackCompanyName = company?.name || 'QuoteCore+ user';
  const companyEmail = profile.email ?? null;

  // ─── 6. Build merge context ───
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const sharedMerge = {
    company_name: fallbackCompanyName,
    company_email: companyEmail ?? undefined,
    sender_name: profile.full_name ?? undefined,
    today,
    customer_name: (entity as { customer_name?: string }).customer_name,
  };

  let entityMerge = await adapter.buildMergeContext(entity, sharedMerge);

  // Orders: inject order_total_items (needs a DB query) + order_link.
  if (input.entityKind === 'order') {
    const { count: itemCount } = await supabase
      .from('material_order_lines')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', entity.id);
    entityMerge = {
      ...entityMerge,
      order_total_items: itemCount != null ? String(itemCount) : undefined,
      order_link: token ? `${getSiteUrl()}/orders/${token}` : undefined,
    };
  }

  // Quotes: inject quote_total (needs customer_quote_lines + tax computation) + quote_link.
  if (input.entityKind === 'quote') {
    const quote = entity as unknown as { id: string; tax_rate: number | null; currency: string | null };
    const quoteTotalString = await computeQuoteTotalForMerge(
      supabase,
      quote.id,
      quote.tax_rate,
      quote.currency,
      company?.default_currency ?? 'NZD',
    );
    entityMerge = {
      ...entityMerge,
      quote_total: quoteTotalString ?? undefined,
      quote_link: token ? `${getSiteUrl()}/accept/${token}` : undefined,
    };
  }

  // ─── 7. Resolve branding ───
  const branding = adapter.resolveBranding(entity, fallbackCompanyName, companyEmail);

  // ─── 8. Validate recipient ───
  const recipient = input.recipientEmail.trim();
  if (!recipient || !/^.+@.+\..+$/.test(recipient)) {
    return { ok: false, error: 'Please enter a valid recipient email.' };
  }

  // ─── 9. Filter attachments ───
  let attachmentSelection = input.attachmentSelection;
  if (attachmentSelection && adapter.filterAttachments) {
    attachmentSelection = adapter.filterAttachments(attachmentSelection);
  }

  // ─── 10. Build pipeline extras ───
  const extras = adapter.pipelineExtras(entity, token);

  // ─── 11. Send ───
  const result = await sendOutboundMessage({
    companyId: profile.company_id,
    senderUserId: profile.id,
    kind: adapter.kind,
    templateId: input.templateId,
    subject: input.subject,
    body: input.body,
    recipientEmail: recipient,
    recipientName: input.recipientName ?? (entity as { customer_name?: string }).customer_name ?? null,
    mergeContext: entityMerge,
    companyName: branding.companyName,
    companyLogoUrl: branding.companyLogoUrl,
    companyEmail: branding.companyEmail,
    companyPhone: branding.companyPhone,
    acceptanceToken: token,
    primaryCta: extras.primaryCta ?? undefined,
    relatedQuoteId: extras.relatedQuoteId,
    relatedOrderId: extras.relatedOrderId,
    attachmentSelection,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // ─── 12. Post-send side effects ───
  if (result.status === 'sent' && adapter.afterSend) {
    await adapter.afterSend(entity, {
      supabase,
      admin,
      profile: { id: profile.id, company_id: profile.company_id, email: profile.email ?? null, full_name: profile.full_name ?? null },
      recipientEmail: recipient,
      result: { messageId: result.messageId, status: result.status },
    });
  }

  // ─── 13. Revalidate paths ───
  // We don't have workspaceSlug in the server action context, but
  // revalidatePath with the literal pattern works for Next.js route invalidation.
  for (const path of adapter.revalidatePaths('', input.entityId)) {
    revalidatePath(path);
  }

  return { ok: true, messageId: result.messageId, status: result.status };
}
