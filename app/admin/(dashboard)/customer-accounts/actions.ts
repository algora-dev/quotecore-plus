'use server';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';
import { seedTemplateComponents } from '@/app/lib/seed/seedTemplateComponents';
export type CreateCustomerResult = { ok: true; email: string; companyName: string; workspaceSlug: string; seededComponents: number } | { ok: false; error: string };
const VALID_MEASUREMENTS = new Set(['metric', 'imperial_ft', 'imperial_rs']);
const RESERVED_PREFIXES = new Set(['admin', 'api', 'auth', 'login', 'signup', 'onboarding', 'orders', 'invoice', 'file', 'accept', 'docs']);
function makeSlug(companyName: string, userId: string) { const base = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'company'; const slug = `${base}-${userId.slice(0, 8)}`; return RESERVED_PREFIXES.has(slug.split('-')[0]) ? `ws-${slug}` : slug; }
export async function createCustomerAccount(formData: FormData): Promise<CreateCustomerResult> {
  const adminProfile = await requireAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const companyName = String(formData.get('companyName') ?? '').trim();
  const temporaryPassword = String(formData.get('temporaryPassword') ?? '');
  const planCode = String(formData.get('planCode') ?? 'starter').trim();
  const currency = String(formData.get('currency') ?? 'NZD').trim().toUpperCase();
  const measurement = String(formData.get('measurement') ?? 'metric').trim();
  const defaultTrade = String(formData.get('defaultTrade') ?? 'roofing').trim();
  const taxRate = Number(formData.get('taxRate') ?? 15);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!fullName || !companyName) return { ok: false, error: 'Customer name and company name are required.' };
  if (temporaryPassword.length < 8) return { ok: false, error: 'Temporary password must be at least 8 characters.' };
  if (!VALID_MEASUREMENTS.has(measurement)) return { ok: false, error: 'Choose a valid measurement system.' };
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { ok: false, error: 'Tax rate must be between 0 and 100.' };
  const admin = createAdminClient();
  const { data: plan } = await admin.from('subscription_plans').select('code').eq('code', planCode).maybeSingle();
  if (!plan) return { ok: false, error: `Plan "${planCode}" does not exist.` };
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true, user_metadata: { full_name: fullName, must_change_password: true } });
  if (authError || !authData.user) return { ok: false, error: authError?.message ?? 'Could not create the login.' };
  const authUserId = authData.user.id;
  try {
    const { data: company, error: companyError } = await admin.from('companies').insert({ name: companyName, slug: makeSlug(companyName, authUserId), default_currency: currency, default_language: 'en', default_measurement_system: measurement as 'metric', default_trade: defaultTrade as 'roofing', default_tax_rate: taxRate, plan_code: planCode, subscription_status: 'canceled', onboarding_completed_at: new Date().toISOString() }).select('id, slug').single();
    if (companyError || !company) throw new Error(companyError?.message ?? 'Could not create the company.');
    const { error: profileError } = await admin.from('users').insert({ id: authUserId, company_id: company.id, email, full_name: fullName, role: 'owner', is_admin: false });
    if (profileError) throw new Error(profileError.message);
    const collectionId = await ensureCompanyHasCollection(company.id, admin);
    const seeded = await seedTemplateComponents(admin, company.id, defaultTrade, collectionId);
    console.log(`[admin/create-customer] created ${email} company=${company.id} by=${adminProfile.id} seeded=${seeded.seeded}`);
    return { ok: true, email, companyName, workspaceSlug: company.slug ?? '', seededComponents: seeded.seeded };
  } catch (error) { await admin.auth.admin.deleteUser(authUserId).catch(() => undefined); return { ok: false, error: error instanceof Error ? error.message : 'Could not finish account setup.' }; }
}
