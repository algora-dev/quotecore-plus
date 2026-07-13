import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';

interface CheckRequest {
  email: string;
  documentType: 'quote' | 'order' | 'invoice';
  documentNumber: string;
}

interface CheckResponse {
  eligible: boolean;
  reason?: 'no_app_account' | 'quota_exceeded' | 'duplicate_number' | 'subscription_inactive';
  details?: {
    planCode?: string;
    used?: number;
    limit?: number;
    duplicateNumber?: string;
  };
  workspaceSlug?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<CheckResponse>> {
  let body: CheckRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }

  const { email, documentType, documentNumber } = body;
  if (!email || !documentType || !documentNumber) {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Find app user by email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appUser, error: userError } = await (admin as any)
    .from('users')
    .select('id, company_id')
    .eq('email', email)
    .maybeSingle();

  if (userError || !appUser?.id || !appUser?.company_id) {
    return NextResponse.json({ eligible: false, reason: 'no_app_account' });
  }

  const companyId = appUser.company_id;

  // 2. Get company info + effective plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('companies')
    .select('slug, plan_code, subscription_status')
    .eq('id', companyId)
    .maybeSingle();

  const workspaceSlug = company?.slug || '';

  // Check subscription is active
  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(company?.subscription_status)) {
    return NextResponse.json({
      eligible: false,
      reason: 'subscription_inactive',
      details: { planCode: company?.plan_code },
      workspaceSlug,
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
    return NextResponse.json({ eligible: false, reason: 'subscription_inactive', workspaceSlug });
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
        workspaceSlug,
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
        workspaceSlug,
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
        workspaceSlug,
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
      workspaceSlug,
    });
  }

  // 6. All checks passed
  return NextResponse.json({
    eligible: true,
    workspaceSlug,
  });
}
