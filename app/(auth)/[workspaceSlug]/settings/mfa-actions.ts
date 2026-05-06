'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

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

export async function getMfaRequired(): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('users')
    .select('mfa_required')
    .eq('id', user.id)
    .single();
  if (error) throw new Error(error.message);
  return Boolean(data?.mfa_required);
}

/**
 * Flip the user's mfa_required flag. The slider in settings calls this.
 *
 * Turning the flag *on* without an enrolled verified factor is a no-op from a
 * security perspective — the middleware checks both flag AND a verified factor
 * before challenging — so the action lets the user toggle freely; the UI is
 * responsible for keeping the slider sensible.
 */
export async function setMfaRequired(required: boolean): Promise<void> {
  const user = await requireUser();
  const admin = createAdminClient();
  // Use service-role so the user table update bypasses RLS (the schema doesn't
  // include a permissive policy for self-update).
  const { error } = await admin
    .from('users')
    .update({ mfa_required: required, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

/**
 * Mark the current user as MFA-required. Call this right after the client
 * successfully verifies their first TOTP factor enrollment so the toggle in
 * settings starts in the on position. Idempotent.
 */
export async function markMfaRequiredAfterEnroll(): Promise<void> {
  const user = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ mfa_required: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
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
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);

  // If that was the user's last verified factor, automatically clear
  // mfa_required so they don't end up locked out behind a /2fa page they have
  // no way to satisfy.
  const { data: remaining } = await supabase.auth.mfa.listFactors();
  const stillVerified = (remaining?.totp ?? []).some((f) => f.status === 'verified');
  if (!stillVerified) {
    const admin = createAdminClient();
    await admin
      .from('users')
      .update({ mfa_required: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  }

  revalidatePath('/');
}
