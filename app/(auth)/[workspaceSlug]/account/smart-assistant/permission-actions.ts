'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import {
  parseSavePermissionsInput,
  permissionFailure,
  type PermissionResult,
} from '@/app/lib/smart-assistant/section-permissions';
import { readSectionPermissions, writeSectionPermissions } from '@/app/lib/smart-assistant/section-permissions.server';

// Intentionally independent of saveAssistantConfig/requireAssistantManager.
// members_can_manage continues to govern V1 identity/knowledge, but can NEVER
// grant a member permission to write this owner/admin-only permission map.
export async function loadAssistantSectionPermissions(): Promise<PermissionResult> {
  await requireCompanyContext();
  const client = await createSupabaseServerClient();
  return readSectionPermissions(client);
}

export async function saveAssistantSectionPermissions(input: unknown): Promise<PermissionResult> {
  await requireCompanyContext();
  const parsed = parseSavePermissionsInput(input);
  if (!parsed) return permissionFailure({ code: '22023' });

  const client = await createSupabaseServerClient();
  // The RPC rechecks membership, owner/admin role and the existing flag in SQL.
  // No service-role client or caller-selected write tenant. expectedCompanyId
  // only rejects a stale page after an account/workspace change.
  const result = await writeSectionPermissions(client, parsed);
  if (result.ok) {
    // The mutation is already acknowledged. Cache invalidation failing must
    // not misreport it as an unsuccessful write or encourage a duplicate save.
    try {
      revalidatePath('/[workspaceSlug]/account/smart-assistant', 'page');
      revalidatePath('/admin/smart-assistant');
    } catch {
      // Both pages are force-dynamic; an explicit refresh also reads the DB.
    }
  }
  return result;
}
