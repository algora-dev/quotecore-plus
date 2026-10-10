import 'server-only';
import type { NextRequest } from 'next/server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { customScope } from '../environment';
import { isCustomUsageCompany, usageClient } from './store';
import { parseScanRequest } from './scan-contract';
import { executePurchasedScan } from './scan-execution';
import { UsageError, usageError } from './contracts';

/** Legacy and demo responses remain on the exact old handler. */
export async function withPurchasedScan(req: NextRequest,
  execute: (req: NextRequest, customMetered: boolean) => Promise<Response>): Promise<Response> {
  try {
    const user = await createSupabaseServerClient();
    const { data: { session } } = await user.auth.getSession();
    if (!session) return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const profile = await requireCompanyContext();
    if (!(await isCustomUsageCompany(profile.company_id))) return execute(req, false);
    if (Number(req.headers.get('content-length') ?? 0) > 26*1024*1024) {
      throw new UsageError('scan_request_too_large', 'The plan image is too large.', 413);
    }
    let raw: unknown;
    try { raw = await req.clone().json(); } catch { throw new UsageError('invalid_scan_request', 'A valid scan request is required.', 400); }
    const r = parseScanRequest(raw, req.headers.get('idempotency-key'));
    const { data: quote, error: quoteError } = await user.from('quotes').select('id')
      .eq('id', r.quoteId).eq('company_id', profile.company_id).maybeSingle();
    if (quoteError || !quote) throw new UsageError('quote_not_found', 'Quote not found.', 404);
    if (r.pageId) {
      const { data: page, error: pageError } = await user.from('takeoff_pages').select('id')
        .eq('id', r.pageId).eq('quote_id', r.quoteId).maybeSingle();
      if (pageError || !page) throw new UsageError('page_not_found', 'Plan page not found.', 404);
    }
    const scope = customScope();
    return await executePurchasedScan({ companyId: profile.company_id, accountId: scope.accountId, mode: scope.mode },
      r, usageClient(), () => execute(req, true));
  } catch (error) {
    const e = usageError(error);
    return Response.json({ success: false, code: e.code, error: e.message, ...e.details },
      { status: e.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }
}
