import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createQuoteAtomic } from '@/app/lib/billing/quote-creation';
import { requireInvoiceFeature } from '@/app/lib/billing/entitlements';
import { requireOrderSlot } from '@/app/lib/billing/entitlements';
import type { Json } from '@/app/lib/supabase/database.types';

export const runtime = 'nodejs';

interface DocDraftData {
  documentType: 'quote' | 'order' | 'invoice';
  documentData: {
    companyName: string;
    fromName?: string;
    fromPhone?: string;
    fromEmail?: string;
    clientName: string;
    clientEmail?: string;
    clientAddress?: string;
    documentNumber: string;
    documentDate: string;
    validDays?: string;
    notes?: string;
    footer?: string;
    logo?: string | null;
    currency: string;
    taxRate?: number;
    taxName?: string;
    lines: Array<{ description: string; qty: number; unit: string; rate: number }>;
  };
  email: string;
  workspaceSlug?: string;
  savedAt: string;
}

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draft');
  if (!draftId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // This is a server-side route - we can't access localStorage.
  // The draft is in localStorage on the client side. So we need a different approach:
  // Redirect to the app dashboard with the draft ID, and let the client-side restore it.

  // Check if user is authenticated to the app
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Not logged in - redirect to login with return path
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `/api/app/import-free-document?draft=${draftId}`);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in - redirect to dashboard with draft restore flag
  // The dashboard client component will read the draft from localStorage and call the POST endpoint
  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  const { data: company } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', profile.company_id)
    .maybeSingle();

  const slug = company?.slug || '';
  const dashboardUrl = new URL(`/${slug}`, req.url);
  dashboardUrl.searchParams.set('restore_doc', draftId);
  return NextResponse.redirect(dashboardUrl);
}

export async function POST(req: NextRequest) {
  // Create entity from draft data (called by dashboard client component after restoring draft)
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { draftId: string; draftData: DocDraftData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get user's company
  const { data: profile } = await admin
    .from('users')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company found' }, { status: 400 });
  }

  const companyId = profile.company_id;
  const { documentType, documentData } = body.draftData;

  // Get company slug for redirect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('companies')
    .select('slug, default_currency')
    .eq('id', companyId)
    .maybeSingle();

  const slug = company?.slug || '';

  try {
    if (documentType === 'quote') {
      const result = await createQuoteFromDraft(admin, companyId, session.user.id, documentData);
      return NextResponse.json({
        success: true,
        redirectUrl: `/${slug}/quotes/${result.quoteId}/blank-build`,
      });
    } else if (documentType === 'order') {
      const result = await createOrderFromDraft(admin, companyId, documentData);
      return NextResponse.json({
        success: true,
        redirectUrl: `/${slug}/material-orders/${result.orderId}/edit`,
      });
    } else if (documentType === 'invoice') {
      const result = await createInvoiceFromDraft(admin, companyId, documentData);
      return NextResponse.json({
        success: true,
        redirectUrl: `/${slug}/invoices/${result.invoiceId}/edit`,
      });
    }
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createQuoteFromDraft(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  userId: string,
  data: DocDraftData['documentData']
): Promise<{ quoteId: string }> {
  // Use the atomic create RPC (handles billing checks + insert)
  const quoteId = await createQuoteAtomic(companyId, userId, {
    customerName: data.clientName || 'Unknown',
    jobName: '',
    entryMode: 'blank',
    trade: 'generic',
    componentCollectionId: null,
    cqCompanyName: data.companyName || null,
    cqCompanyPhone: data.fromPhone || null,
    cqCompanyEmail: data.fromEmail || null,
    cqCompanyLogoUrl: data.logo || null,
    cqFooterText: data.footer || data.notes || null,
    currency: data.currency,
    materialMarginPercent: 0,
    materialMarginEnabled: false,
  });

  // Insert customer quote lines
  if (data.lines.length > 0) {
    const lines = data.lines.map((l, i) => ({
      quote_id: quoteId,
      line_type: 'custom' as const,
      sort_order: i,
      custom_text: l.description,
      custom_amount: l.qty * l.rate,
      show_price: true,
      is_visible: true,
      include_in_total: true,
      quantity: l.qty,
      unit_price: l.rate,
      quantity_text: l.qty !== 1 || l.unit ? `${l.qty}${l.unit ? ' ' + l.unit : ''}` : null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linesError } = await (admin as any)
      .from('customer_quote_lines')
      .insert(lines);

    if (linesError) {
      console.error('[import-free-document] Failed to insert quote lines:', linesError);
    }
  }

  // Insert tax if specified
  if (data.taxRate && data.taxRate > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: taxError } = await (admin as any)
      .from('quote_taxes')
      .insert({
        quote_id: quoteId,
        name: data.taxName || 'Tax',
        rate_percent: data.taxRate,
        include_in_quote: true,
        include_in_labor: false,
      });

    if (taxError) {
      console.error('[import-free-document] Failed to insert tax:', taxError);
    }
  }

  return { quoteId };
}

async function createOrderFromDraft(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  data: DocDraftData['documentData']
): Promise<{ orderId: string }> {
  // Check order slot
  await requireOrderSlot(companyId);

  // Build line_by_line_data structure
  const lineByLineData = {
    lines: data.lines.map((l, i) => ({
      id: `line-${i}`,
      componentName: l.description,
      quantity: l.qty,
      unit: l.unit || 'pcs',
      unitPrice: l.rate,
      lineTotal: l.qty * l.rate,
      showComponentName: true,
      showMeasurements: false,
      notes: '',
    })),
    footer: data.footer || '',
    taxes: data.taxRate ? [{ name: data.taxName || 'Tax', rate: data.taxRate }] : [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (admin as any)
    .from('material_orders')
    .insert({
      company_id: companyId,
      reference: data.documentNumber,
      to_supplier: data.clientName || '',
      from_company: data.companyName || '',
      contact_person: data.fromName || '',
      contact_details: data.fromPhone || data.fromEmail || '',
      order_date: data.documentDate || new Date().toISOString().slice(0, 10),
      delivery_date: null,
      delivery_address: '',
      order_notes: data.notes || '',
      logo_url: data.logo || null,
      layout_mode: 'line_by_line',
      line_by_line_data: lineByLineData as unknown as Json,
      status: 'draft',
    })
    .select('id')
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message || 'Unknown error'}`);
  }

  return { orderId: order.id };
}

async function createInvoiceFromDraft(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  data: DocDraftData['documentData']
): Promise<{ invoiceId: string }> {
  // Check invoice feature access
  await requireInvoiceFeature(companyId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error: invoiceError } = await (admin as any)
    .from('invoices')
    .insert({
      company_id: companyId,
      invoice_number: data.documentNumber,
      customer_name: data.clientName || '',
      customer_email: data.clientEmail || '',
      from_company: data.companyName || '',
      from_email: data.fromEmail || '',
      from_phone: data.fromPhone || '',
      logo_url: data.logo || null,
      invoice_date: data.documentDate || new Date().toISOString().slice(0, 10),
      due_date: null,
      notes: data.notes || '',
      footer_text: data.footer || '',
      currency: data.currency,
      status: 'draft',
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    throw new Error(`Failed to create invoice: ${invoiceError?.message || 'Unknown error'}`);
  }

  const invoiceId = invoice.id;

  // Insert invoice lines
  if (data.lines.length > 0) {
    const lines = data.lines.map((l, i) => ({
      invoice_id: invoiceId,
      company_id: companyId,
      sort_order: i,
      line_source_type: 'custom',
      source_id: null,
      title: l.description,
      description: null,
      quantity: l.qty,
      unit: l.unit || '',
      unit_price: l.rate,
      line_total: l.qty * l.rate,
      show_price: true,
      is_visible: true,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linesError } = await (admin as any)
      .from('invoice_lines')
      .insert(lines);

    if (linesError) {
      console.error('[import-free-document] Failed to insert invoice lines:', linesError);
    }
  }

  return { invoiceId };
}
