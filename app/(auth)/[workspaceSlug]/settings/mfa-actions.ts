'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';

/**
 * Server-side helpers for the 2FA flow.
 *
 * Enrollment + verification *must* run from a client component because the
 * @supabase/supabase-js MFA helpers (`enroll`, `challenge`, `verify`) use the
 * user's local session storage to track the in-flight challenge state. Trying
 * to do that across server actions causes "factorId not found" errors. So this
 * file only exposes the read-only listing + the destructive unenroll.
 */

export interface MfaFactorSummary {
  id: string;
  friendly_name: string | null;
  factor_type: 'totp' | 'phone' | string;
  status: 'verified' | 'unverified' | string;
  created_at: string | null;
}

export async function listMfaFactors(): Promise<{
  factors: MfaFactorSummary[];
  currentAal: 'aal1' | 'aal2' | null;
}> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);

  // Surface only TOTP factors for now (phone / WebAuthn aren't enabled at the
  // project level). All TOTP factors are returned by listFactors regardless
  // of status, so we keep both verified + unverified to let the UI clean up
  // half-finished enrollments.
  const factors: MfaFactorSummary[] = (data?.totp ?? []).map((f) => ({
    id: f.id,
    friendly_name: f.friendly_name ?? null,
    factor_type: f.factor_type,
    status: f.status,
    created_at: f.created_at ?? null,
  }));

  // aal == 'aal2' once the user verifies a factor for this session.
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentAal = (aalData?.currentLevel as 'aal1' | 'aal2' | null) ?? null;

  return { factors, currentAal };
}

export async function unenrollMfaFactor(factorId: string): Promise<void> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);

  revalidatePath('/');
}
