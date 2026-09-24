import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import type { AssistantV2Database } from './v2-database.types';
import {
  parsePermissionSnapshot,
  permissionFailure,
  type PermissionResult,
  type SavePermissionsInput,
} from './section-permissions';

/** The only cast: draft RPCs/tables are not in the supplied generated types yet. */
export function assistantV2Client(client: SupabaseClient<Database>): SupabaseClient<AssistantV2Database> {
  return client as unknown as SupabaseClient<AssistantV2Database>;
}

function decodeRow(data: unknown): PermissionResult {
  if (!Array.isArray(data) || data.length !== 1) return permissionFailure(null);
  const snapshot = parsePermissionSnapshot(data[0]);
  return snapshot ? { ok: true, snapshot } : permissionFailure(null);
}

/** The read DB function derives company/role from auth.uid(); it has no tenant argument. */
export async function readSectionPermissions(client: SupabaseClient<Database>): Promise<PermissionResult> {
  try {
    const { data, error } = await assistantV2Client(client).rpc('sa_v2_permissions_read', {});
    if (error) return permissionFailure(error);
    return decodeRow(data);
  } catch {
    return permissionFailure(null);
  }
}

export async function writeSectionPermissions(
  client: SupabaseClient<Database>,
  input: SavePermissionsInput,
): Promise<PermissionResult> {
  try {
    const { data, error } = await assistantV2Client(client).rpc('sa_v2_permissions_save', {
      p_permissions: input.permissions,
      p_expected_revision: input.expectedRevision,
      // A stale-page guard only, never authority to choose the write tenant.
      p_expected_company_id: input.expectedCompanyId,
    });
    if (error) return permissionFailure(error);
    // RETURNING/SELECT in the same transaction supplies the acknowledged map.
    // Do not claim success just because an optimistic client update succeeded.
    const result = decodeRow(data);
    if (result.ok && (result.snapshot.source !== 'saved' || result.snapshot.companyId !== input.expectedCompanyId)) return permissionFailure(null);
    return result;
  } catch {
    return permissionFailure(null);
  }
}
