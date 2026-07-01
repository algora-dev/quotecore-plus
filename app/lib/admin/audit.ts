import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Shared admin audit helper (Gerald H-02).
 *
 * Extracted from app/admin/(dashboard)/users/[userId]/actions.ts so all
 * new admin server actions can use the same audit pattern with correct
 * snapshots.
 *
 * Writes to `admin_actions` with:
 *   admin_user_id, target_company_id, target_user_id,
 *   admin_email_snapshot, target_user_email_snapshot,
 *   target_company_name_snapshot, action_type, reason, details.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export interface AdminProfile {
  id: string;
  email: string;
}

export async function writeAudit(
  admin: AdminClient,
  adminProfile: AdminProfile,
  actionType: string,
  targetCompanyId: string | null,
  targetUserId: string | null,
  targetEmail: string | null,
  targetCompanyName: string | null,
  reason: string | null,
  details: Record<string, unknown> | null,
): Promise<void> {
  await admin.from('admin_actions').insert({
    admin_user_id: adminProfile.id,
    target_company_id: targetCompanyId,
    target_user_id: targetUserId,
    admin_email_snapshot: adminProfile.email,
    target_user_email_snapshot: targetEmail,
    target_company_name_snapshot: targetCompanyName,
    action_type: actionType,
    reason,
    details: details as never,
  });
}
