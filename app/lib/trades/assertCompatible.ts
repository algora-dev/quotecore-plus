/**
 * Generic Trades Phase 6 — central trade-compatibility helper.
 *
 * Gerald round-2 M-03: every server action that creates a `quote_components`
 * row MUST call this helper before the write. No inline checks anywhere.
 *
 * The static-grep regression at `scripts/test-trade-helper-imports.mjs`
 * walks every server-action file and asserts that any file containing an
 * INSERT/UPSERT against `quote_components` imports this module. Adding a
 * new attach path WITHOUT calling the helper fails the regression at PR
 * time.
 *
 * Used by:
 *   - app/(auth)/[workspaceSlug]/quotes/actions.ts (addQuoteComponent,
 *     cloneQuote re-attach loop, createQuoteFromTemplate template seed)
 *   - app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts
 *     (saveTakeoffMeasurements component-from-measurement creation)
 *   - any future `applyTemplate` or component-attach flow
 *
 * The check is ENFORCEMENT, not advisory: throws a typed
 * TradeIncompatibleError on refusal, which surfaces as a structured
 * `{ ok: false, code: 'trade_incompatible' }` response at the server-
 * action boundary instead of a 500.
 */

import { createAdminClient } from '@/app/lib/supabase/admin';
import {
  TRADE_ALLOWED_MEASUREMENT_TYPES,
  type MeasurementType,
  type Trade,
} from './measurement-type-whitelist';

export class TradeIncompatibleError extends Error {
  readonly code = 'trade_incompatible' as const;
  constructor(
    public readonly trade: Trade,
    public readonly measurementType: MeasurementType,
    public readonly quoteId: string,
    public readonly componentId: string,
  ) {
    super(
      `Component (measurement_type=${measurementType}) is not allowed on a ${trade} quote.`,
    );
    this.name = 'TradeIncompatibleError';
  }
}

/**
 * Asserts that a `component_library` row is compatible with a `quotes` row
 * before the caller writes a `quote_components` link between them.
 *
 * Uses the admin client to read both rows under service-role (bypasses RLS)
 * — same posture as createQuoteAtomic and ensureCompanyHasCollection. The
 * caller still validates ownership separately; this helper only validates
 * trade/measurement compatibility.
 *
 * @throws TradeIncompatibleError when the component cannot attach.
 * @throws Error('not_found') when either row is missing or company-mismatched.
 */
export async function assertComponentCompatibleWithQuote(args: {
  quoteId: string;
  componentId: string;
  companyId: string;
}): Promise<void> {
  const { quoteId, componentId, companyId } = args;
  const admin = createAdminClient();

  // Read quote + component in parallel under service-role.
  // Both reads are scoped by company_id so a stale UI cannot trick this into
  // greenlighting a cross-company attach.
  const [quoteResult, componentResult] = await Promise.all([
    // database.types.ts hasn't been regenerated since Phase 2; cast at the
    // boundary for the new `trade` column.
    (admin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { trade: Trade | null } | null;
                error: Error | null;
              }>;
            };
          };
        };
      };
    })
      .from('quotes')
      .select('trade')
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .maybeSingle(),
    admin
      .from('component_library')
      .select('measurement_type')
      .eq('id', componentId)
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);

  if (quoteResult.error || !quoteResult.data) {
    throw new Error(
      `assertComponentCompatibleWithQuote: quote ${quoteId} not found (company ${companyId}).`,
    );
  }
  if (componentResult.error || !componentResult.data) {
    throw new Error(
      `assertComponentCompatibleWithQuote: component ${componentId} not found (company ${companyId}).`,
    );
  }

  // Default a missing/legacy `trade` value to 'roofing' so pre-Phase-2 rows
  // (impossible after this morning's migration but defensive) keep working.
  const trade: Trade = quoteResult.data.trade ?? 'roofing';
  const measurementType = componentResult.data.measurement_type as MeasurementType;

  const allowed = TRADE_ALLOWED_MEASUREMENT_TYPES[trade];
  if (!allowed?.has(measurementType)) {
    throw new TradeIncompatibleError(trade, measurementType, quoteId, componentId);
  }
}
