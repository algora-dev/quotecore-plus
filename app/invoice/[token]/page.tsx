import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { PublicInvoiceView, type Invoice, type InvoiceLine } from './PublicInvoiceView';
import { StampRecipientView } from '@/app/lib/recipient/StampRecipientView';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

function isValidUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function InvalidScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Invoice Not Found</h1>
        <p className="text-sm text-slate-500">This link may be invalid or the invoice has been cancelled.</p>
      </div>
    </div>
  );
}

function RateLimitScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Too Many Requests</h1>
        <p className="text-sm text-slate-500">Please try again later.</p>
      </div>
    </div>
  );
}

export default async function PublicInvoicePage({ params }: Props) {
  const { token } = await params;

  if (!token || !isValidUUID(token)) return <InvalidScreen />;

  // Rate limit: 30 views per IP per hour
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  if (!(await checkRateLimit(`invoice-view-ip:${ip}`, 30, 60 * 60 * 1000))) {
    return <RateLimitScreen />;
  }

  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (!invoice || invoice.status === 'cancelled') return <InvalidScreen />;

  // NOTE: viewed-status stamping is NOT done here in the GET render. Email/link
  // scanners issue GET requests and would falsely mark the invoice "Read".
  // Stamping happens via <StampRecipientView> below, which fires an idempotent
  // POST server action on genuine client mount. See MEMORY "GET-on-mutate is a
  // class of bug".

  // Load lines. H-04 defence-in-depth: scope by the invoice's company_id too
  // (service-role read bypasses RLS), so cross-tenant-polluted child rows can
  // never render here. The composite tenant FK now makes pollution impossible
  // at the DB layer; this filter is the belt-and-braces backstop.
  const { data: lines } = await admin
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoice.id)
    .eq('company_id', invoice.company_id)
    .order('sort_order');

  return (
    <>
      <StampRecipientView kind="invoice" token={token} />
      <PublicInvoiceView
        invoice={invoice as unknown as Invoice}
        lines={(lines ?? []) as unknown as InvoiceLine[]}
        token={token}
      />
    </>
  );
}
