import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getDemoControl } from './control';

/**
 * Demo provisioner v1 (Architecture V2 §7/§8) — walking skeleton.
 * Creates a fresh fictional sandbox company for an anonymous visitor:
 * companies + users + assistant_configs + demo_sessions (active, 24h).
 * Seed richness (components/quotes/plan file) lands with the clone manifest
 * increment; this skeleton proves the isolation + lifecycle machinery.
 */

const TEMPLATE_VERSION = 'v1-skeleton';
const SESSION_HOURS = 24;
const MAX_PROVISIONS_PER_IP_PER_HOUR = 5;

export class DemoProvisionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ipHmacFor(ip: string | null): string {
  const secret = process.env.DEMO_IP_HMAC_SECRET || 'demo-dev-hmac-key';
  return createHmac('sha256', secret).update(ip || 'unknown').digest('hex');
}

function demoSlug(): string {
  return `demo-${Math.random().toString(36).slice(2, 8)}`;
}

type CompanyRow = Record<string, unknown> & { id?: string; slug?: string };

/** Company row built from an existing company's SHAPE (NOT NULL coverage)
 * with every identity/subscription field replaced by fictional demo values. */
function fictionalCompanyFrom(template: CompanyRow, id: string, slug: string): CompanyRow {
  const row: CompanyRow = { ...template };
  // Identity
  row.id = id;
  row.slug = slug;
  row.name = 'Demo Roofing';
  // Plan: the demo plan row (unpurchasable) + active status passes the
  // paywall gate via company_effective_plan_active().
  row.plan_code = 'demo';
  row.subscription_status = 'active';
  // Strip every real-billing/override signal.
  row.stripe_subscription_id = null;
  row.stripe_customer_id = null;
  row.comp_until = null;
  row.admin_override_plan_code = null;
  row.admin_override_until = null;
  row.admin_paused = false;
  row.trial_ends_at = null;
  return row;
}

export async function provisionDemo(anonUserId: string, ip: string | null): Promise<{ slug: string }> {
  // 1. Master switch (fail closed)
  const control = await getDemoControl();
  if (!control.demoEnabled) throw new DemoProvisionError('The demo is currently switched off.', 503);

  const admin = createAdminClient();
  const ipHmac = ipHmacFor(ip);

  // 2. Resume: an active, unexpired session for this anon user returns its sandbox.
  const { data: existing } = await admin
    .from('demo_sessions')
    .select('id, expires_at, company_id')
    .eq('anon_user_id', anonUserId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.company_id) {
    const { data: co } = await admin
      .from('companies')
      .select('slug')
      .eq('id', existing.company_id)
      .maybeSingle();
    if (co?.slug) return { slug: co.slug };
  }

  // 3. IP provision rate limit (HMAC — raw IP is never stored).
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent } = await admin
    .from('demo_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hmac', ipHmac)
    .gte('created_at', hourAgo);
  if ((recent ?? 0) >= MAX_PROVISIONS_PER_IP_PER_HOUR) {
    throw new DemoProvisionError('Too many demo sessions from this network. Try again later.', 429);
  }

  // 4. Provision: company (shape from template) + owner profile + assistant defaults.
  const { data: templateCompany } = await admin
    .from('companies')
    .select('*')
    .not('slug', 'like', 'demo-%')
    .limit(1)
    .maybeSingle();
  if (!templateCompany) throw new DemoProvisionError('Demo template unavailable.', 500);

  const companyId = randomUUID();
  const slug = demoSlug();
  const companyRow = fictionalCompanyFrom(templateCompany as CompanyRow, companyId, slug);

  const { error: companyError } = await admin.from('companies').insert(companyRow as never); // template-shaped row: required fields guaranteed by fictionalCompanyFrom overrides
  if (companyError) throw new DemoProvisionError(`Provisioning failed: ${companyError.message}`, 500);

  const { error: userError } = await admin.from('users').insert({
    id: anonUserId,
    company_id: companyId,
    email: `demo-${anonUserId.slice(0, 8)}@demo.invalid`,
    full_name: 'Demo User',
    role: 'owner',
  });
  if (userError) {
    await admin.from('companies').delete().eq('id', companyId); // compensating cleanup
    throw new DemoProvisionError(`Provisioning failed: ${userError.message}`, 500);
  }

  await admin.from('assistant_configs').insert({ company_id: companyId }).then(() => undefined, () => undefined); // defaults are fine

  // 5. Session row: active immediately, expires in 24h (resumable).
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  const { error: sessionError } = await admin.from('demo_sessions').insert({
    anon_user_id: anonUserId,
    company_id: companyId,
    template_version: TEMPLATE_VERSION,
    ip_hmac: ipHmac,
    status: 'active',
    activated_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
  if (sessionError) {
    await admin.from('companies').delete().eq('id', companyId);
    throw new DemoProvisionError(`Provisioning failed: ${sessionError.message}`, 500);
  }

  return { slug };
}
