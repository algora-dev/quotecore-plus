import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { isFreeWorkspaceCompany } from '@/app/lib/billing/free-workspace';

/**
 * Activation-nudge state for the demo-first onboarding cohort (owner
 * 2026-11-13). Cohort = free workspace that has been shown the welcome modal
 * over the guided demo. Everything is company-level, service-role, and
 * best-effort: a failed read just disables the nudges for that render.
 *
 * First personal-workspace visit is stamped here (first-wins) because it
 * anchors both nudge timers.
 */
export type OnboardingNudgeState = {
  active: boolean;
  firstVisitAt: string | null;
  companyCreatedAt: string | null;
  componentCount: number;
  quoteCount: number;
  pricingNudgeShown: boolean;
  quoteNudgeShown: boolean;
};

const INACTIVE: OnboardingNudgeState = {
  active: false,
  firstVisitAt: null,
  companyCreatedAt: null,
  componentCount: 0,
  quoteCount: 0,
  // "shown: true" keeps the client timer from firing anything.
  pricingNudgeShown: true,
  quoteNudgeShown: true,
};

export const loadOnboardingNudgeState = cache(
  async (companyId: string, componentCount: number, quoteCount: number): Promise<OnboardingNudgeState> => {
    try {
      // Loose structural cast: the onboarding columns sit outside the
      // generated types (same pattern as free_entry_modal).
      const admin = createAdminClient() as unknown as {
        from(table: string): {
          select(cols: string): {
            eq(col: string, val: string): { maybeSingle(): Promise<{ data: unknown }> };
          };
          update(row: Record<string, unknown>): {
            eq(col: string, val: string): { is(col: string, val: null): Promise<{ error: unknown }> };
          };
        };
      };
      const { data } = await admin
        .from('companies')
        .select('created_at, welcome_modal_seen_at, first_workspace_visit_at, pricing_nudge_shown_at, quote_nudge_shown_at')
        .eq('id', companyId)
        .maybeSingle();
      const row = data as {
        created_at?: string | null;
        welcome_modal_seen_at?: string | null;
        first_workspace_visit_at?: string | null;
        pricing_nudge_shown_at?: string | null;
        quote_nudge_shown_at?: string | null;
      } | null;
      if (!row?.welcome_modal_seen_at) return INACTIVE; // not the demo-first cohort
      const freeWorkspace = await isFreeWorkspaceCompany(companyId);
      if (!freeWorkspace) return INACTIVE;

      let firstVisitAt = row.first_workspace_visit_at ?? null;
      if (!firstVisitAt) {
        // Stamp the anchor now. A failed stamp only delays the nudges to the
        // next visit - harmless.
        const now = new Date().toISOString();
        const { error } = await admin
          .from('companies')
          .update({ first_workspace_visit_at: now })
          .eq('id', companyId)
          .is('first_workspace_visit_at', null);
        if (!error) firstVisitAt = now;
      }

      return {
        active: true,
        firstVisitAt,
        companyCreatedAt: row.created_at ?? null,
        componentCount,
        quoteCount,
        pricingNudgeShown: !!row.pricing_nudge_shown_at,
        quoteNudgeShown: !!row.quote_nudge_shown_at,
      };
    } catch {
      return INACTIVE;
    }
  },
);
