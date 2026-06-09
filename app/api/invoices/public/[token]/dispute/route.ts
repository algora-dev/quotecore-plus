import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { alertEnabled, emailAlertEnabled } from '@/app/lib/alerts/prefs';
import { notifyGenericAlert } from '@/app/lib/email/notify';
import { invoiceDetailUrl } from '@/app/lib/email/urls';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { headers } from 'next/headers';

/**
 * POST /api/invoices/public/[token]/dispute
 * Customer submits a dispute. No auth required.
 * Rate-limited per IP.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const hdrs = await headers();
  const ip = getClientIP(hdrs);

  // Rate limit: 3 disputes per IP per hour
  if (!(await checkRateLimit(`invoice-dispute:${ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, company_id, invoice_number, customer_name, status')
    .eq('public_token', token)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Can't dispute a cancelled or already-paid invoice
  if (['cancelled', 'paid'].includes(invoice.status)) {
    return NextResponse.json({ error: 'Cannot dispute this invoice' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const recipientName = (typeof body?.name === 'string' ? body.name : '').slice(0, 200).trim();
  const recipientEmail = (typeof body?.email === 'string' ? body.email : '').slice(0, 200).trim();
  const reason = (typeof body?.reason === 'string' ? body.reason : '').slice(0, 500).trim();
  const message = (typeof body?.message === 'string' ? body.message : '').slice(0, 2000).trim();

  if (!recipientName || !reason || !message) {
    return NextResponse.json({ error: 'Name, reason, and message are required' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Store dispute record
  await admin.from('invoice_disputes').insert({
    invoice_id: invoice.id,
    company_id: invoice.company_id,
    recipient_name: recipientName,
    recipient_email: recipientEmail || null,
    reason,
    message,
  });

  // Update invoice status
  await admin
    .from('invoices')
    .update({ status: 'disputed', disputed_at: now })
    .eq('id', invoice.id);

  // Log activity
  await admin.from('invoice_activity').insert({
    invoice_id: invoice.id,
    company_id: invoice.company_id,
    event_type: 'dispute_submitted',
    metadata: { recipient_name: recipientName, reason, disputed_at: now },
  });

  // Alert account owner. Dispute record + status update above always happen;
  // this alert is gated by the Message Center notification matrix.
  const alertMessage = `${recipientName} has disputed invoice ${invoice.invoice_number}. Reason: ${reason}`;
  if (await alertEnabled(admin, invoice.company_id, 'invoice_disputed')) {
    await admin.from('alerts').insert({
      company_id: invoice.company_id,
      invoice_id: invoice.id,
      alert_type: 'invoice_disputed',
      title: 'Invoice Disputed',
      message: alertMessage,
    });
  }

  // Best-effort alert email, gated independently (default ON for disputes).
  if (await emailAlertEnabled(admin, invoice.company_id, 'invoice_disputed')) {
    let ctaUrl: string | null = null;
    const { data: company } = await admin
      .from('companies')
      .select('slug')
      .eq('id', invoice.company_id)
      .maybeSingle();
    if (company?.slug) ctaUrl = invoiceDetailUrl(company.slug, invoice.id);
    await notifyGenericAlert({
      companyId: invoice.company_id,
      alertType: 'invoice_disputed',
      title: 'Invoice Disputed',
      body: alertMessage,
      ctaUrl,
      ctaLabel: 'View invoice',
    });
  }

  return NextResponse.json({ ok: true });
}
