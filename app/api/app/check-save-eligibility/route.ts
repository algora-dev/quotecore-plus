import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { resolveFreeToolsTier } from '@/app/lib/free-tools/resolveTier';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';

interface CheckRequest {
  documentType: 'quote' | 'order' | 'invoice';
  documentNumber: string;
}

interface CheckResponse {
  eligible: boolean;
  reason?: 'authentication_required' | 'onboarding_required' | 'quota_exceeded' | 'duplicate_number' | 'subscription_inactive';
  details?: {
    planCode?: string;
    used?: number;
    limit?: number;
    duplicateNumber?: string;
  };
}

export async function POST(req: NextRequest): Promise<NextResponse<CheckResponse>> {
  const caller = await resolveFreeToolsTier(req.headers.get('authorization'));
  if (!caller.userId) {
    return NextResponse.json(
      { eligible: false, reason: 'authentication_required' },
      { status: 401 },
    );
  }

  const ip = getClientIP(req.headers);
  const withinLimit = await checkRateLimit(
    `save-eligibility:${caller.userId}:${ip}`,
    30,
    60 * 60 * 1000,
    { failClosed: true },
  );
  if (!withinLimit) {
    return NextResponse.json({ eligible: false }, { status: 429 });
  }

  let body: CheckRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }

  const { documentType, documentNumber } = body;
  if (!['quote', 'order', 'invoice'].includes(documentType) || !documentNumber?.trim()) {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Resolve the authenticated caller's own workspace. Never accept an
  // email or user id from the client for account lookup.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appUser, error: userError } = await (admin as any)
    .from('users')
    .select('id, company_id')
    .eq('id', caller.userId)
    .maybeSingle();

  if (userError || !appUser?.id || !appUser?.company_id) {
    return NextResponse.json({ eligible: false, reason: 'onboarding_required' });
  }

  const companyId = appUser.company_id;

  // 2. Get company info + effective plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('companies')
    .select('slug, plan_code, subscription_status')
    .eq('id', companyId)
    .maybeSingle();

  // Check subscription is active
  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(company?.subscription_status)) {
    return NextResponse.json({
      eligible: false,
      reason: 'subscription_inactive',
      details: { planCode: company?.plan_code },
    });
  }

  // Get effective plan code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: effPlanCode } = await (admin as any)
    .rpc('company_effective_plan_code', { p_company_id: companyId });

  const planCode = (effPlanCode as string | null) ?? 'starter';

  // 3. Get plan limits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (admin as any)
    .from('subscription_plans')
    .select('monthly_quote_limit, monthly_invoice_limit, monthly_material_order_limit')
    .eq('code', planCode)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ eligible: false, reason: 'subscription_inactive' });
  }

  // 4. Check quotas based on document type
  if (documentType === 'quote') {
    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usage } = await (admin as any)
      .from('company_quote_usage')
      .select('quotes_created')
      .eq('company_id', companyId)
      .eq('period_start', periodStart)
      .maybeSingle();

    const used = usage?.quotes_created ?? 0;
    const limit = plan.monthly_quote_limit ?? 0;
    if (limit > 0 && used >= limit) {
      return NextResponse.json({
        eligible: false,
        reason: 'quota_exceeded',
        details: { planCode, used, limit },
      });
    }
  } else if (documentType === 'order') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: count } = await (admin as any).rpc('company_order_count', { p_company_id: companyId });
    const used = typeof count === 'number' ? count : 0;
    const limit = plan.monthly_material_order_limit ?? 0;
    if (limit > 0 && used >= limit) {
      return NextResponse.json({
        eligible: false,
        reason: 'quota_exceeded',
        details: { planCode, used, limit },
      });
    }
  } else if (documentType === 'invoice') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: count } = await (admin as any).rpc('company_invoice_count', { p_company_id: companyId });
    const used = typeof count === 'number' ? count : 0;
    const limit = plan.monthly_invoice_limit ?? 0;
    if (limit > 0 && used >= limit) {
      return NextResponse.json({
        eligible: false,
        reason: 'quota_exceeded',
        details: { planCode, used, limit },
      });
    }
  }

  // 5. Check duplicate document number
  let dupTable = 'quotes';
  let dupColumn = 'quote_number';
  if (documentType === 'order') {
    dupTable = 'material_orders';
    dupColumn = 'reference';
  } else if (documentType === 'invoice') {
    dupTable = 'invoices';
    dupColumn = 'invoice_number';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: dupCount } = await (admin as any)
    .from(dupTable)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq(dupColumn, documentNumber);

  if ((dupCount ?? 0) > 0) {
    return NextResponse.json({
      eligible: false,
      reason: 'duplicate_number',
      details: { duplicateNumber: documentNumber },
    });
  }

  // 6. All checks passed
  return NextResponse.json({ eligible: true });
}
