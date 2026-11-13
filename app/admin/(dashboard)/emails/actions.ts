'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendEmail } from '@/app/lib/email/send';
import { getUnsubscribeHmacSecret } from '@/app/lib/marketing/adminSecrets';
import { renderOutreachVars, buildOutreachUnsubscribeUrl } from '@/app/lib/email/renderOutreach';

/**
 * Admin outreach emails (owner 2026-11-13): DB-stored templates
 * (outreach_templates) sent to hand-picked recent signups from the admin
 * Emails page. Every send is logged to outreach_send_log (dedupe + sent
 * badges), suppressions are respected, and each email carries a signed
 * per-recipient unsubscribe link.
 */

const DEFAULT_OUTREACH_TEMPLATE = 'stuck_welcome_help';

export interface OutreachRecipient {
  companyId: string;
  companyName: string;
  ownerName: string | null;
  ownerEmail: string;
  userId: string | null;
  signedUpAt: string;
  componentCount: number;
  quoteCount: number;
  demoSession: boolean;
  suppressed: boolean;
  sentAt: string | null;
}

export interface OutreachTemplateInfo {
  key: string;
  name: string;
  subject: string;
}

export type OutreachLoadResult =
  | { ok: true; template: OutreachTemplateInfo | null; previewHtml: string; recipients: OutreachRecipient[] }
  | { ok: false; error: string };

export type SendOutcome =
  | { companyId: string; email: string; status: 'sent' | 'skipped' | 'failed'; detail?: string };

export type SendResult =
  | { ok: true; summary: { sent: number; skipped: number; failed: number }; outcomes: SendOutcome[] }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function loadEmailOutreach(templateKey: string = DEFAULT_OUTREACH_TEMPLATE): Promise<OutreachLoadResult> {
  await requireAdmin();
  const admin = createAdminClient();
  // Loose structural cast: the outreach_* tables are outside the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = admin as unknown as { from(table: string): any };

  const { data: tpl } = await loose.from('outreach_templates')
    .select('key, name, subject, html')
    .eq('key', templateKey)
    .eq('is_active', true)
    .maybeSingle();
  const template = tpl as OutreachTemplateInfo & { html: string } | null;

  const previewHtml = template
    ? renderOutreachVars(template.html, {
        firstName: 'Alex',
        companyName: 'Alex Roofing',
        unsubscribeUrl: 'https://app.quote-core.com/unsubscribe/preview-token',
      })
    : '';

  const { data: companies, error } = await admin
    .from('companies')
    .select('id, name, created_at')
    .or('plan_code.neq.demo,plan_code.is.null')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message };

  const companyIds = (companies ?? []).map((c) => c.id as string);
  if (!companyIds.length) return { ok: true, template, previewHtml, recipients: [] };

  const { data: ownerRows } = await admin
    .from('users')
    .select('id, company_id, email, full_name')
    .in('company_id', companyIds)
    .eq('role', 'owner');
  const ownerByCompany = new Map<string, { id: string; email: string; full_name: string | null }>();
  for (const owner of (ownerRows ?? []) as { id: string; company_id: string; email: string; full_name: string | null }[]) {
    if (!ownerByCompany.has(owner.company_id)) ownerByCompany.set(owner.company_id, owner);
  }

  const rows = (companies ?? [])
    .map((c) => ({ c, owner: ownerByCompany.get(c.id as string) }))
    .filter(({ owner }) => !!owner?.email) as {
    c: { id: string; name: string; created_at: string };
    owner: { id: string; email: string; full_name: string | null };
  }[];
  const emails = rows.map(({ owner }) => owner.email.toLowerCase());

  // Bounded row-id pulls + client-side counting: two queries instead of
  // 200 per-company head counts. 5000-row ceiling keeps the payload sane
  // even if a supplier with a large catalog sneaks into the list.
  const [componentRows, quoteRows, demoRows, suppressionRows, sentRows] = await Promise.all([
    loose.from('component_library').select('company_id').eq('is_active', true).in('company_id', companyIds).limit(5000),
    loose.from('quotes').select('company_id').in('company_id', companyIds).limit(5000),
    emails.length ? loose.from('demo_sessions').select('owner_email').in('owner_email', emails).limit(500) : { data: [] },
    emails.length ? loose.from('message_suppressions').select('email').in('email', emails).limit(500) : { data: [] },
    emails.length
      ? loose.from('outreach_send_log').select('email, sent_at, status')
          .eq('template_key', templateKey).eq('status', 'sent').in('email', emails).limit(2000)
      : { data: [] },
  ]);

  const countBy = (list: { company_id?: string | null }[] | null | undefined) => {
    const map = new Map<string, number>();
    for (const row of list ?? []) {
      if (row?.company_id) map.set(row.company_id, (map.get(row.company_id) ?? 0) + 1);
    }
    return map;
  };
  const componentCounts = countBy(componentRows?.data);
  const quoteCounts = countBy(quoteRows?.data);
  const demoEmails = new Set(
    ((demoRows?.data ?? []) as { owner_email?: string | null }[]).map((r) => (r.owner_email ?? '').toLowerCase()),
  );
  const suppressedEmails = new Set(
    ((suppressionRows?.data ?? []) as { email?: string | null }[]).map((r) => (r.email ?? '').toLowerCase()),
  );
  const sentByEmail = new Map<string, string>();
  for (const row of ((sentRows?.data ?? []) as { email?: string | null; sent_at?: string | null }[])) {
    const email = (row.email ?? '').toLowerCase();
    const at = row.sent_at ?? '';
    if (email && (!sentByEmail.has(email) || at > (sentByEmail.get(email) ?? ''))) sentByEmail.set(email, at);
  }

  const recipients: OutreachRecipient[] = rows.map(({ c, owner }) => {
    const emailLower = owner.email.toLowerCase();
    return {
      companyId: c.id,
      companyName: c.name,
      ownerName: owner.full_name ?? null,
      ownerEmail: owner.email,
      userId: owner.id,
      signedUpAt: c.created_at,
      componentCount: componentCounts.get(c.id) ?? 0,
      quoteCount: quoteCounts.get(c.id) ?? 0,
      demoSession: demoEmails.has(emailLower),
      suppressed: suppressedEmails.has(emailLower),
      sentAt: sentByEmail.get(emailLower) ?? null,
    };
  });

  return { ok: true, template, previewHtml, recipients };
}

export async function sendOutreachEmails(
  templateKey: string,
  companyIds: string[],
): Promise<SendResult> {
  await requireAdmin();
  if (!companyIds.length) return { ok: false, error: 'No recipients selected.' };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = admin as unknown as { from(table: string): any };

  const { data: tpl } = await loose.from('outreach_templates')
    .select('key, name, subject, html')
    .eq('key', templateKey)
    .eq('is_active', true)
    .maybeSingle();
  const template = tpl as { key: string; subject: string; html: string } | null;
  if (!template) return { ok: false, error: 'Template not found or inactive.' };

  const hmacSecret = await getUnsubscribeHmacSecret();
  if (!hmacSecret) return { ok: false, error: 'Unsubscribe signing secret is not configured.' };

  const load = await loadEmailOutreach(templateKey);
  if (!load.ok) return { ok: false, error: load.error };
  const selected = load.recipients.filter((r) => companyIds.includes(r.companyId));
  if (!selected.length) return { ok: false, error: 'Selected recipients no longer exist.' };

  const outcomes: SendOutcome[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of selected) {
    const emailLower = recipient.ownerEmail.toLowerCase();
    if (recipient.suppressed) {
      outcomes.push({ companyId: recipient.companyId, email: recipient.ownerEmail, status: 'skipped', detail: 'suppressed' });
      await loose.from('outreach_send_log').insert({
        template_key: templateKey, company_id: recipient.companyId, user_id: recipient.userId,
        email: recipient.ownerEmail, status: 'skipped', detail: 'message_suppressions',
      });
      skipped += 1;
      continue;
    }
    if (recipient.sentAt) {
      outcomes.push({ companyId: recipient.companyId, email: recipient.ownerEmail, status: 'skipped', detail: 'already sent' });
      skipped += 1;
      continue;
    }

    const html = renderOutreachVars(template.html, {
      firstName: recipient.ownerName?.split(' ')[0] ?? null,
      companyName: recipient.companyName,
      unsubscribeUrl: buildOutreachUnsubscribeUrl(emailLower, hmacSecret),
    });

    const result = await sendEmail({
      to: recipient.ownerEmail,
      subject: template.subject,
      html,
      tags: [{ name: 'campaign', value: templateKey }],
    });

    if (result.ok) {
      sent += 1;
      outcomes.push({ companyId: recipient.companyId, email: recipient.ownerEmail, status: 'sent' });
      await loose.from('outreach_send_log').insert({
        template_key: templateKey, company_id: recipient.companyId, user_id: recipient.userId,
        email: recipient.ownerEmail, status: 'sent',
      });
    } else {
      failed += 1;
      outcomes.push({ companyId: recipient.companyId, email: recipient.ownerEmail, status: 'failed', detail: result.error });
      await loose.from('outreach_send_log').insert({
        template_key: templateKey, company_id: recipient.companyId, user_id: recipient.userId,
        email: recipient.ownerEmail, status: 'failed', detail: result.error,
      });
    }
    // Gentle pacing: keeps us well inside Resend's per-second comfort zone.
    await sleep(300);
  }

  revalidatePath('/admin/emails');
  return { ok: true, summary: { sent, skipped, failed }, outcomes };
}
