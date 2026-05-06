'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_GROUPS = 3;
const RECOVERY_CODE_GROUP_LEN = 4; // total = 12 chars + 2 dashes -> 14 visible

export interface RecoveryCodeStatus {
  total: number;
  used: number;
  remaining: number;
}

function hashCode(raw: string): string {
  // Strip whitespace + dashes, uppercase, hash. We want display formatting
  // ("ABCD-EFGH-IJKL") to be irrelevant when comparing -- the user might paste
  // it with or without dashes.
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function newRawCode(): string {
  // Use crypto.randomBytes for a uniform distribution over 32-char alphabet.
  // We exclude characters that look alike (0/O, 1/I/L) so the codes are easier
  // to read off paper.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const groups: string[] = [];
  for (let g = 0; g < RECOVERY_CODE_GROUPS; g++) {
    let group = '';
    while (group.length < RECOVERY_CODE_GROUP_LEN) {
      const byte = crypto.randomBytes(1)[0];
      // Reject bytes that would bias the distribution.
      if (byte >= Math.floor(256 / alphabet.length) * alphabet.length) continue;
      group += alphabet[byte % alphabet.length];
    }
    groups.push(group);
  }
  return groups.join('-');
}

export async function getRecoveryCodeStatus(): Promise<RecoveryCodeStatus> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_recovery_codes')
    .select('used_at')
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);

  const total = data?.length ?? 0;
  const used = (data ?? []).filter((r) => r.used_at !== null).length;
  return { total, used, remaining: total - used };
}

/**
 * Generate a fresh batch of recovery codes. Returns the *plaintext* codes once.
 * They are NOT recoverable after this call -- only the hashes are stored.
 *
 * Generating a new batch invalidates the previous batch.
 */
export async function generateRecoveryCodes(): Promise<string[]> {
  const user = await requireUser();
  // Service role: we need to bypass RLS to insert + delete on the user's behalf.
  // RLS on user_recovery_codes is intentionally read-only for end users so this
  // is the only mutation path.
  const admin = createAdminClient();

  // Wipe any existing batch so old codes can't be reused.
  const { error: delErr } = await admin
    .from('user_recovery_codes')
    .delete()
    .eq('user_id', user.id);
  if (delErr) throw new Error(delErr.message);

  const rawCodes: string[] = [];
  const rows: { user_id: string; code_hash: string }[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const raw = newRawCode();
    rawCodes.push(raw);
    rows.push({ user_id: user.id, code_hash: hashCode(raw) });
  }

  const { error: insErr } = await admin.from('user_recovery_codes').insert(rows);
  if (insErr) throw new Error(insErr.message);

  revalidatePath('/');
  return rawCodes;
}

/**
 * Validate a recovery code against the stored hashes for the *current* user
 * (must be at least AAL1, i.e. signed in but not yet 2FA-verified).
 *
 * On success: marks the code used and returns true. The caller is responsible
 * for nuking the user's existing TOTP factor and routing them to a fresh
 * enrollment flow -- a recovery code is single-use and forces the user to
 * re-bind a new authenticator before they regain AAL2.
 */
export async function consumeRecoveryCode(rawCode: string): Promise<boolean> {
  const user = await requireUser();
  const admin = createAdminClient();

  const hash = hashCode(rawCode);
  const { data, error } = await admin
    .from('user_recovery_codes')
    .select('id, used_at')
    .eq('user_id', user.id)
    .eq('code_hash', hash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;
  if (data.used_at !== null) return false; // already burned

  const { error: updErr } = await admin
    .from('user_recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', data.id);
  if (updErr) throw new Error(updErr.message);

  return true;
}

/**
 * Helper for the recovery-flow step that wipes the user's existing TOTP
 * factor(s). Used right after consumeRecoveryCode succeeds, so the user is
 * forced to re-bind a fresh authenticator before regaining AAL2.
 */
export async function clearTotpFactorsForCurrentUser(): Promise<void> {
  const user = await requireUser();
  const admin = createAdminClient();

  // The service-role admin client exposes auth.admin.mfa.* which can list and
  // delete factors for any user. Note the API uses `id`, not `factorId`.
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (error) throw new Error(error.message);

  for (const f of data?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  }

  revalidatePath('/');
}
