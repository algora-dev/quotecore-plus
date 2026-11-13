'use server';

import { getCurrentProfile } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

/**
 * Demo-first onboarding stamps (owner 2026-11-13). Company-level +
 * first-stamp-wins so each one-time surface shows once per account across
 * devices and users. companies is not user-writable through RLS, so these are
 * service-role writes (same pattern as recordFreeEntryChoice). Best-effort:
 * a failed stamp just means the surface may reappear next load, which is
 * harmless.
 */
async function stampCompany(
  companyId: string,
  patch: Record<string, unknown>,
  guardColumn: string,
): Promise<{ ok: boolean }> {
  try {
    const admin = createAdminClient() as unknown as {
      from(table: string): {
        update(row: Record<string, unknown>): {
          eq(col: string, val: string): { is(col: string, val: null): Promise<{ error: unknown }> };
        };
      };
    };
    const { error } = await admin
      .from('companies')
      .update(patch)
      .eq('id', companyId)
      .is(guardColumn, null);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

async function currentCompanyId(): Promise<string | null> {
  try {
    const profile = await getCurrentProfile();
    return profile?.company_id ?? null;
  } catch {
    return null;
  }
}

/** Welcome modal rendered over the demo launcher. */
export async function recordWelcomeSeen(): Promise<{ ok: boolean }> {
  const companyId = await currentCompanyId();
  if (!companyId) return { ok: false };
  return stampCompany(companyId, { welcome_modal_seen_at: new Date().toISOString() }, 'welcome_modal_seen_at');
}

/** Welcome-modal CTA choice: continue into the demo, or get in touch. */
export async function recordWelcomeChoice(choice: 'continue' | 'get_in_touch'): Promise<{ ok: boolean }> {
  const companyId = await currentCompanyId();
  if (!companyId) return { ok: false };
  return stampCompany(
    companyId,
    { welcome_modal_choice: choice, welcome_modal_seen_at: new Date().toISOString() },
    'welcome_modal_choice',
  );
}

/** Tips modal ("first three tasks / add your pricing first"). */
export async function recordDemoTipsSeen(): Promise<{ ok: boolean }> {
  const companyId = await currentCompanyId();
  if (!companyId) return { ok: false };
  return stampCompany(companyId, { demo_tips_seen_at: new Date().toISOString() }, 'demo_tips_seen_at');
}

/** First visit to the personal workspace after the welcome flow; anchors the
 * activation-nudge timers. */
export async function recordFirstWorkspaceVisit(): Promise<{ ok: boolean }> {
  const companyId = await currentCompanyId();
  if (!companyId) return { ok: false };
  return stampCompany(companyId, { first_workspace_visit_at: new Date().toISOString() }, 'first_workspace_visit_at');
}

/** One-time activation nudges inside the workspace. */
export async function recordNudgeShown(kind: 'pricing' | 'quote'): Promise<{ ok: boolean }> {
  const companyId = await currentCompanyId();
  if (!companyId) return { ok: false };
  const column = kind === 'pricing' ? 'pricing_nudge_shown_at' : 'quote_nudge_shown_at';
  return stampCompany(companyId, { [column]: new Date().toISOString() }, column);
}
