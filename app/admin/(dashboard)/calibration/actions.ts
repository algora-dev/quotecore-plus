'use server';

// P7 admin polish: AI-assisted calibration flag admin, mirroring the
// Smart Assistant dark-launch panel exactly (same requireAdmin +
// createAdminClient server-action pattern; no new auth mechanism).
// Writes go through the service-role-only set_calibration_flag RPC
// (patch_046) instead of a direct table upsert, matching the RPC-based
// trust model documented in that migration.
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { writeAudit } from '@/app/lib/admin/audit';

export type CalibrationCompanyRow = {
  company_id: string;
  name: string;
  slug: string | null;
  plan_code: string | null;
  owner_email: string | null;
  owner_name: string | null;
  enabled: boolean;
  enabled_at: string | null;
};

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function listCalibrationCompanies(
  filter?: string,
): Promise<{ ok: true; rows: CalibrationCompanyRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: companyRows, error: companyErr } = await admin
    .from('companies')
    .select('id, name, slug, plan_code')
    .order('created_at', { ascending: false })
    .limit(500);

  if (companyErr) {
    return { ok: false, error: companyErr.message };
  }

  const companyIds = (companyRows ?? []).map((c: { id: string }) => c.id);

  const [ownerRes, flagRes] = await Promise.all([
    companyIds.length
      ? admin
          .from('users')
          .select('company_id, email, full_name')
          .in('company_id', companyIds)
          .eq('role', 'owner')
      : Promise.resolve({ data: [] as { company_id: string; email: string; full_name: string | null }[], error: null }),
    companyIds.length
      ? admin
          .from('calibration_feature_flags')
          .select('company_id, enabled, updated_at')
          .in('company_id', companyIds)
      : Promise.resolve({ data: [] as { company_id: string; enabled: boolean; updated_at: string }[], error: null }),
  ]);

  const ownerByCompany = new Map(
    (ownerRes.data ?? []).map((u) => [u.company_id, u]),
  );
  const flagByCompany = new Map(
    (flagRes.data ?? []).map((f) => [f.company_id, f]),
  );

  let rows: CalibrationCompanyRow[] = (companyRows ?? []).map((c) => {
    const owner = ownerByCompany.get(c.id);
    const flag = flagByCompany.get(c.id);
    return {
      company_id: c.id,
      name: c.name,
      slug: c.slug,
      plan_code: c.plan_code ?? null,
      owner_email: owner?.email ?? null,
      owner_name: owner?.full_name ?? null,
      enabled: flag?.enabled ?? false,
      enabled_at: flag?.updated_at ?? null,
    };
  });

  if (filter && filter.trim()) {
    const q = filter.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.slug ?? '').toLowerCase().includes(q) ||
        (r.owner_email ?? '').toLowerCase().includes(q),
    );
  }

  rows.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { ok: true, rows };
}

export async function setCalibrationEnabled(
  companyId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const adminProfile = await requireAdmin();
  const admin = createAdminClient();

  if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
    return { ok: false, error: 'Invalid company id.' };
  }

  // Service-role RPC (patch_046): exec granted to service_role only, so the
  // write cannot be driven from a member session even if the action leaked.
  const { error } = await admin.rpc('set_calibration_flag', {
    p_company_id: companyId,
    p_enabled: enabled,
    p_updated_by: adminProfile.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await writeAudit(
    admin,
    adminProfile,
    enabled ? 'calibration_ai_enabled' : 'calibration_ai_disabled',
    companyId,
    null,
    null,
    null,
    null,
    { companyId, enabled },
  );

  revalidatePath('/admin/calibration');
  return { ok: true, message: enabled ? 'Access granted' : 'Access revoked' };
}
