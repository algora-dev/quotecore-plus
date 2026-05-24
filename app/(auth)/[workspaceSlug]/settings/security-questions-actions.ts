'use server';

/**
 * Server actions for managing the user's security questions.
 *
 * Storage rules: see migration 20260509180100_user_security_questions.sql.
 *   - Plain question text is stored.
 *   - Answer is normalised (lowercased, whitespace-collapsed) then bcrypt-hashed.
 *   - We never return answer_hash to the client.
 *
 * Why bcrypt instead of sha256: bcrypt has a tunable work factor and a per-row
 * salt that makes rainbow-table attacks against leaked answer columns
 * impractical. The exact same threat model as user passwords.
 */

import bcrypt from 'bcryptjs';
import { createSupabaseServerClient, requireUser } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { normaliseAnswer, QUESTION_SLOTS } from '@/app/lib/security/questions';

export interface SecurityQuestionRecord {
  slot: number;
  question: string;
  /** True if the user has set an answer for this slot. We never return the hash itself. */
  isSet: boolean;
  updatedAt: string | null;
}

const BCRYPT_COST = 10;

/**
 * Returns the user's currently-set security questions in slot order. The
 * answer hashes are NEVER returned. The Settings UI uses this both to render
 * the current state ("2 of 2 set") and to pre-fill the question stem when the
 * user updates a slot.
 */
export async function listSecurityQuestions(): Promise<SecurityQuestionRecord[]> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('user_security_questions')
    .select('slot, question, updated_at')
    .eq('user_id', user.id)
    .order('slot', { ascending: true });

  if (error) {
    console.error('[security-questions] list failed:', error);
    return [];
  }

  // Build a sparse view across all slots so the UI can render placeholders for
  // empty slots without coupling itself to which slots happen to exist.
  const out: SecurityQuestionRecord[] = [];
  for (let s = 1; s <= QUESTION_SLOTS; s++) {
    const row = data?.find((r) => r.slot === s);
    out.push({
      slot: s,
      question: row?.question ?? '',
      isSet: !!row,
      updatedAt: row?.updated_at ?? null,
    });
  }
  return out;
}

/**
 * Upsert one slot. If the user is replacing an existing answer, we re-hash
 * the new one rather than trying to detect "no change" - this keeps the
 * action idempotent on retry.
 */
export async function upsertSecurityQuestion(input: {
  slot: number;
  question: string;
  answer: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const slot = Number(input.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > QUESTION_SLOTS) {
    return { ok: false, error: 'Invalid question slot.' };
  }

  const question = (input.question ?? '').trim();
  if (question.length < 5 || question.length > 200) {
    return { ok: false, error: 'Question must be between 5 and 200 characters.' };
  }

  const answerRaw = input.answer ?? '';
  const answerNormalised = normaliseAnswer(answerRaw);
  if (answerNormalised.length < 2 || answerNormalised.length > 200) {
    return { ok: false, error: 'Answer must be between 2 and 200 characters.' };
  }

  const answerHash = await bcrypt.hash(answerNormalised, BCRYPT_COST);

  // Use the admin client for the upsert: the client is RLS-safe (we tagged
  // it with the user's id explicitly), but the upsert ergonomics are simpler
  // here. The unique (user_id, slot) constraint keeps duplicates out.
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from('user_security_questions')
    .upsert(
      {
        user_id: user.id,
        slot,
        question,
        answer_hash: answerHash,
        updated_at: now,
      },
      { onConflict: 'user_id,slot' }
    );
  if (error) {
    console.error('[security-questions] upsert failed:', error);
    return { ok: false, error: 'Could not save your security question. Please try again.' };
  }
  return { ok: true };
}

/**
 * Delete a single slot. Used when the user wants to drop down from 2
 * questions to 1 (rare but valid).
 */
export async function deleteSecurityQuestion(slot: number): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('user_security_questions')
    .delete()
    .eq('user_id', user.id)
    .eq('slot', slot);
}

/**
 * Used during onboarding to upsert all slots at once. Skips slots whose
 * `answer` is empty so the user can fill in 1 of 2 if they want.
 */
export async function setOnboardingSecurityQuestions(
  rows: { slot: number; question: string; answer: string }[]
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  let saved = 0;
  for (const r of rows) {
    if (!r.answer.trim()) continue;
    const res = await upsertSecurityQuestion(r);
    if (!res.ok) return { ok: false, error: res.error };
    saved++;
  }
  return { ok: true, saved };
}
