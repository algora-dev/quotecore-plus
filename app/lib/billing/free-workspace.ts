import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * True when the company runs on the admin-free Free Workspace grant (the
 * "admin-free-" marker). Used to gate customer-facing quote watermarks and
 * any surface that should distinguish free from paid workspaces.
 *
 * Loose structural cast: company_custom_billing is a service-role table
 * outside the generated types (same pattern as admin-grant enforcement).
 */
export async function isFreeWorkspaceCompany(companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return false;
  try {
    const admin = createAdminClient() as unknown as {
      from(table: string): {
        select(cols: string): {
          eq(col: string, val: string): { maybeSingle(): Promise<{ data: unknown }> };
        };
      };
    };
    const { data } = await admin
      .from('company_custom_billing')
      .select('stripe_subscription_id')
      .eq('company_id', companyId)
      .maybeSingle();
    const sub = (data as { stripe_subscription_id?: string } | null)?.stripe_subscription_id;
    return typeof sub === 'string' && sub.startsWith('admin-free-');
  } catch {
    // A lookup failure must never break document rendering.
    return false;
  }
}
