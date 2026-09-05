import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { buildQuoteExport } from '@/app/lib/integrations/export-builder/build-quote-export';
import { getXeroAccessToken, XeroApi } from '@/app/lib/integrations/xero/xero';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/integrations/xero/export-quote  { quoteId }
 * Exports the quote's customer-facing lines to Xero as a DRAFT ACCREC
 * invoice (contact upserted by name) and best-effort attaches the stored
 * customer quote PDF when one exists.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();
    const companyId = profile?.company_id as string | undefined;
    if (!companyId) {
      return NextResponse.json({ error: 'No company context' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { quoteId?: string };
    const quoteId = body.quoteId;
    if (!quoteId) {
      return NextResponse.json({ error: 'quoteId is required' }, { status: 400 });
    }

    const token = await getXeroAccessToken(companyId);
    if (!token) {
      return NextResponse.json({ error: 'Xero is not connected' }, { status: 400 });
    }
    const api = new XeroApi(token.accessToken, token.connection.tenant_id);

    const quote = await buildQuoteExport(quoteId, companyId);
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Customer-facing lines only (respect visibility + include-in-total flags).
    const lineItems = quote.customerLines
      .filter((l) => l.visibleToCustomer && l.includedInTotal && l.type !== 'roof_area_header')
      .map((l) => {
        const qty = l.quantity && l.quantity > 0 ? l.quantity : 1;
        const unitAmount = l.unitPrice !== null ? Number(l.unitPrice) : Number(l.lineTotal) / qty;
        return {
          description: l.description || 'Quote line',
          quantity: qty,
          unitAmount: Math.round(unitAmount * 10000) / 10000,
        };
      });
    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Quote has no customer-facing lines to export' },
        { status: 400 }
      );
    }

    const contactId = await api.upsertContact(
      quote.customer?.name || 'Unknown Customer',
      quote.customer?.email ?? null
    );

    const currency =
      quote.totals?.currency && /^[A-Za-z]{3}$/.test(quote.totals.currency)
        ? quote.totals.currency.toUpperCase()
        : null;

    const invoice = await api.createDraftInvoice({
      contactId,
      reference: `QuoteCore+ Quote ${quoteId.slice(0, 8)}`,
      currencyCode: currency,
      lineItems,
    });

    // Best-effort: attach the stored customer quote PDF.
    let attachedPdf = false;
    try {
      const pdfArtifact = (quote.artifacts ?? []).find(
        (a) => a.role === 'customer_quote_pdf' && (a as { url?: string }).url
      ) as { url?: string; fileName?: string } | undefined;
      if (pdfArtifact?.url) {
        const fileRes = await fetch(pdfArtifact.url);
        if (fileRes.ok) {
          const buf = await fileRes.arrayBuffer();
          attachedPdf = await api.attachFileToInvoice(
            invoice.invoiceId,
            pdfArtifact.fileName || `quote-${quoteId.slice(0, 8)}.pdf`,
            'application/pdf',
            buf
          );
        }
      }
    } catch (attachErr) {
      console.warn('[xero/export-quote] PDF attach skipped:', attachErr);
    }

    return NextResponse.json({
      success: true,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      tenantName: token.connection.tenant_name,
      attachedPdf,
    });
  } catch (err) {
    console.error('[xero/export-quote] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to export to Xero' },
      { status: 500 }
    );
  }
}
