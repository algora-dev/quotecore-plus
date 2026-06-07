import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { headers } from 'next/headers';

/**
 * POST /api/invoices/public/[token]/payment-sent
 * Customer reports they have made payment. No auth required.
 * Rate-limited per IP.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const hdrs = await headers();
  const ip = getClientIP(hdrs);

  // Rate limit: 5 payment reports per IP per hour
  if (!(await checkRateLimit(`invoice-payment-sent:${ip}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, company_id, invoice_number, customer_name, status, total, currency')
    .eq('public_token', token)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only valid from 'sent' or 'viewed' status
  if (!['sent', 'viewed'].includes(invoice.status)) {
    return NextResponse.json({ error: 'Invalid status for this action' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const body = await req.json().catch(() => ({}));
  const customerMessage = typeof body?.message === 'string' ? body.message.slice(0, 500) : '';

  // Update invoice status
  await admin
    .from('invoices')
    .update({ status: 'payment_reported', payment_reported_at: now })
    .eq('id', invoice.id);

  // Log activity
  await admin.from('invoice_activity').insert({
    invoice_id: invoice.id,
    company_id: invoice.company_id,
    event_type: 'payment_reported',
    metadata: { customer_message: customerMessage, reported_at: now },
  });

  // Alert account owner
  await admin.from('alerts').insert({
    company_id: invoice.company_id,
    invoice_id: invoice.id,
    alert_type: 'invoice_payment_reported',
    title: 'Payment Reported',
    message: `${invoice.customer_name} has reported payment for invoice ${invoice.invoice_number}. Please check your bank and confirm receipt.${customerMessage ? ` Note: "${customerMessage}"` : ''}`,
  });

  return NextResponse.json({ ok: true });
}
