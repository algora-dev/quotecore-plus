'use server';

/**
 * Invoice adapter for the unified send-document pipeline.
 *
 * Invoices are the simplest: static public_token (no generation/mint),
 * library-file attachments (added 2026-07-02), post-send side effects
 * (status flip + activity + alert).
 */

import { formatCurrency } from '@/app/lib/currency/currencies';
import { getSiteUrl } from '@/app/lib/email/urls';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentSendAdapter, LoadedEntity, SharedMergeContext, AfterSendContext } from '../types';

interface InvoiceEntity extends LoadedEntity {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  currency: string | null;
  total: number | string | null;
  due_date: string | null;
  public_token: string;
  status: string;
  sent_at: string | null;
  cq_company_name: string | null;
  cq_company_email: string | null;
  cq_company_phone: string | null;
  cq_company_logo_url: string | null;
}

export const invoiceAdapter: DocumentSendAdapter = {
  kind: 'invoice_send',

  async loadEntity(supabase, companyId, id) {
    const { data, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, customer_name, customer_email, currency, total, due_date, public_token, status, sent_at, cq_company_name, cq_company_email, cq_company_phone, cq_company_logo_url',
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error || !data) return null;
    return data as InvoiceEntity;
  },

  validateSendable(entity) {
    const inv = entity as InvoiceEntity;
    if (['cancelled', 'paid'].includes(inv.status)) {
      return 'This invoice cannot be sent in its current state.';
    }
    return null;
  },

  async resolveToken(entity) {
    // Invoices use a static public_token — no generation needed.
    return (entity as InvoiceEntity).public_token;
  },

  async buildMergeContext(entity, shared) {
    const inv = entity as InvoiceEntity;
    const siteUrl = getSiteUrl();
    const invoicePublicUrl = `${siteUrl}/invoice/${encodeURIComponent(inv.public_token)}`;
    const currency = inv.currency ?? 'GBP';
    const invoiceTotalString = formatCurrency(Number(inv.total ?? 0), currency);
    const dueDateString = inv.due_date
      ? new Date(inv.due_date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';

    return {
      ...shared,
      invoice_number: inv.invoice_number ?? undefined,
      invoice_total: invoiceTotalString,
      invoice_link: invoicePublicUrl,
      due_date: dueDateString || undefined,
    };
  },

  resolveBranding(entity, companyName, companyEmail) {
    const inv = entity as InvoiceEntity;
    return {
      companyName: inv.cq_company_name || companyName,
      companyEmail: inv.cq_company_email || companyEmail,
      companyPhone: inv.cq_company_phone,
      companyLogoUrl: inv.cq_company_logo_url,
    };
  },

  pipelineExtras(entity, token) {
    const inv = entity as InvoiceEntity;
    const siteUrl = getSiteUrl();
    const invoicePublicUrl = `${siteUrl}/invoice/${encodeURIComponent(inv.public_token)}`;
    return {
      primaryCta: {
        label: 'View Invoice',
        url: invoicePublicUrl,
      },
    };
  },

  async afterSend(entity, ctx: AfterSendContext) {
    const inv = entity as InvoiceEntity;
    // Only on a real send (not suppressed), and only flip draft→sent.
    if (ctx.result.status !== 'sent' || inv.status !== 'draft') return;

    const now = new Date().toISOString();
    await ctx.supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: now })
      .eq('id', inv.id)
      .eq('company_id', ctx.profile.company_id);

    await ctx.admin.from('invoice_activity').insert({
      invoice_id: inv.id,
      company_id: ctx.profile.company_id,
      event_type: 'sent',
      metadata: {
        recipient_email: ctx.recipientEmail,
        sent_by_user_id: ctx.profile.id,
      },
    });

    await ctx.admin.from('alerts').insert({
      company_id: ctx.profile.company_id,
      invoice_id: inv.id,
      alert_type: 'invoice_sent',
      title: 'Invoice Sent',
      message: `Invoice ${inv.invoice_number} was sent to ${ctx.recipientEmail}.`,
    });
  },

  revalidatePaths(workspaceSlug, entityId) {
    return [
      `/[workspaceSlug]/invoices/${entityId}`,
      `/[workspaceSlug]/invoices`,
    ];
  },

  filterAttachments(sel) {
    // Invoice attachments: library only (new feature — Shaun approved 2026-07-02).
    // Quote files are not applicable to invoices.
    return {
      libraryAttachmentIds: sel.libraryAttachmentIds ?? [],
      quoteFileIds: [],
    };
  },
};
