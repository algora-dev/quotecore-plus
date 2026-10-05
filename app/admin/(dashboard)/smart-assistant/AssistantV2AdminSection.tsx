import 'server-only';

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { assistantV2Client } from '@/app/lib/smart-assistant/section-permissions.server';
import { DEFAULT_SECTION_PERMISSIONS, parsePermissionSnapshot, permissionFailure } from '@/app/lib/smart-assistant/section-permissions';
import { AssistantV2AdminPanel, type AdminPermissionEntry } from './AssistantV2AdminPanel';

export async function AssistantV2AdminSection({ companies }: { companies: { company_id: string; name: string }[] }) {
  // Read-only admin diagnostics. This uses the EXISTING site-admin gate.
  // Grant/revoke, quota, plan and entitlement paths are not modified.
  await requireAdmin();
  const entries: AdminPermissionEntry[] = [];
  let error: string | null = null;
  try {
    if (companies.length > 0) {
      const client = assistantV2Client(createAdminClient());
      const { data, error: queryError } = await client.from('assistant_section_permissions')
        .select('company_id, permissions, revision, updated_at')
        .in('company_id', companies.map((company) => company.company_id))
        .limit(500);
      if (queryError) {
        error = permissionFailure(queryError).error;
      } else {
        const byCompany = new Map((data ?? []).map((row) => [row.company_id, row]));
        for (const company of companies) {
          const row = byCompany.get(company.company_id);
          const snapshot = row ? parsePermissionSnapshot({ ...row, source: 'saved', can_manage: false }) : null;
          entries.push({
            companyId: company.company_id,
            name: company.name,
            permissions: row ? snapshot?.permissions ?? null : { ...DEFAULT_SECTION_PERMISSIONS },
            source: row ? snapshot ? 'saved' : 'invalid' : 'default',
            revision: snapshot?.revision ?? null,
          });
        }
      }
    }
  } catch {
    error = 'V2 permission diagnostics could not be loaded. Existing access controls are unchanged.';
  }
  // No action payloads, voice phrases, messages or transcripts are fetched.
  return <AssistantV2AdminPanel entries={entries} error={error} />;
}
