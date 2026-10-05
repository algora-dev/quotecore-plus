import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { buildQuoteExport } from '@/app/lib/integrations/export-builder/build-quote-export';
import { getQboAccessToken, QboApi } from '@/app/lib/integrations/quickbooks/qbo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/integrations/quickbooks/export-quote  { quoteId }
 * Exports the quote's customer-facing lines to QuickBooks Online as a draft
 * invoice (customer upserted by display name, generic service item).
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

    const token = await getQboAccessToken(companyId);
    if (!token) {
      return NextResponse.json({ error: 'QuickBooks is not connected' }, { status: 400 });
    }
    const api = new QboApi(token.accessToken, token.connection.realm_id);

    const quote = await buildQuoteExport(quoteId, companyId);
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

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

    const customerId = await api.upsertCustomer(
      quote.customer?.name || 'Unknown Customer',
      quote.customer?.email ?? null
    );
    const itemId = await api.ensureServiceItem();

    const currency =
      quote.totals?.currency && /^[A-Za-z]{3}$/.test(quote.totals.currency)
        ? quote.totals.currency.toUpperCase()
        : null;

    const invoice = await api.createDraftInvoice({
      customerId,
      itemId,
      reference: `QuoteCore+ Quote ${quoteId.slice(0, 8)}`,
      currency,
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
          attachedPdf = await api.attachPdfToInvoice(
            invoice.invoiceId,
            pdfArtifact.fileName || `quote-${quoteId.slice(0, 8)}.pdf`,
            buf
          );
        }
      }
    } catch (attachErr) {
      console.warn('[qbo/export-quote] PDF attach skipped:', attachErr);
    }

    return NextResponse.json({
      success: true,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.docNumber,
      attachedPdf,
    });
  } catch (err) {
    console.error('[qbo/export-quote] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to export to QuickBooks' },
      { status: 500 }
    );
  }
}
