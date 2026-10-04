import 'server-only';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { isDemoCompany, readActiveDemoContext } from './context';
import { canEnterChapter } from './guide';
import { DemoError } from './errors';
import { assertSameOrigin, demoErrorResponse, demoJson, readSmallJson } from './http';
import { isRecord } from './model';
import { preparedScanResponse } from './prepared-scan';
import { recordDemoEventBestEffort } from './progress';
export async function assertDemoTakeoffQuote(quoteId: string, pageId?: string | null) {
  const client = await createSupabaseServerClient();
  const { data: quote, error } = await client.from('quotes').select('company_id').eq('id', quoteId).maybeSingle();
  if (error || !quote) throw new DemoError('Quote not found.', 404);
  if (!await isDemoCompany(quote.company_id)) return null;
  const { data: { user } } = await client.auth.getUser();
  const context = user?.is_anonymous === true ? await readActiveDemoContext(quote.company_id, user.id) : null;
  if (!context || !canEnterChapter(context.tutorialState, 'takeoff') || context.tutorialState.seed.guided_roof_job !== quoteId ||
      (pageId && context.tutorialState.seed.guided_takeoff_plan !== pageId)) throw new DemoError('Use the prepared job and plan in the guided Takeoff demo.', 403, 'demo_takeoff_gate');
  return context;
}
export async function servePreparedDemoScan(request: NextRequest, companyId: string) {
  try {
    assertSameOrigin(request);
    const body = await readSmallJson(request, 10 * 1024 * 1024);
    if (!isRecord(body) || typeof body.quoteId !== 'string' || typeof body.pageId !== 'string') throw new DemoError('Prepared job and page are required.');
    const context = await assertDemoTakeoffQuote(body.quoteId, body.pageId);
    if (!context || context.companyId !== companyId) throw new DemoError('Prepared demo only.', 403);
    let response: ReturnType<typeof preparedScanResponse>;
    try { response = preparedScanResponse(body); } catch { throw new DemoError('The prepared scan request is invalid. Reopen the prepared plan.'); }
    if (body.stage === 'scan3') {
      const client = await createSupabaseServerClient();
      const saved = await client.from('takeoff_pages').update({ ai_scan_result: JSON.parse(JSON.stringify(response.data)) })
        .eq('id', body.pageId).eq('quote_id', body.quoteId);
      if (saved.error) throw new DemoError('The prepared scan could not be saved. Please retry.', 503);
      await recordDemoEventBestEffort(companyId, 'scan.loaded', body.pageId);
    }
    return demoJson(response);
  } catch (error) { return demoErrorResponse(error); }
}
