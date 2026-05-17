'use server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { seedQuoteTaxesOnCreate } from '@/app/lib/taxes/seed';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { createQuoteAtomic } from '@/app/lib/billing/quote-creation';
import {
  QuoteLimitReachedError,
  SubscriptionInactiveError,
  StorageQuotaExceededError,
  FeatureGatedError,
  isBillingError,
} from '@/app/lib/billing/errors';
import { finaliseUpload } from '@/app/lib/files/upload-finaliser';

/**
 * Structured result for {@link createQuoteWithDetails}. The action returns
 * this instead of throwing for known billing failures, because Next 16
 * masks thrown errors from server actions in production (the client only
 * sees a digest, not the original message). Returning the failure as data
 * lets QuoteDetailsForm render the typed amber banner reliably.
 *
 * The `void` branch is the template-mode path: createQuoteFromTemplate
 * already issues its own redirect() and never returns, so the caller
 * sees `undefined` on success in that case.
 */
export type CreateQuoteResult =
  | { ok: true; quoteId?: string }
  | {
      ok: false;
      code:
        | 'quote_limit_reached'
        | 'subscription_inactive'
        | 'feature_gated'
        | 'storage_quota_exceeded'
        | 'unknown';
      message: string;
      /** Extra context for the UI — only populated for some codes. */
      details?: Record<string, string | number | null>;
    };

interface CreateQuoteParams {
  customerName: string;
  jobName: string | null;
  templateId: string | null;
  /**
   * Entry method for the quote:
   *   - `manual`: traditional quote builder (Areas → Components → Extras → Review).
   *   - `digital`: digital takeoff canvas first, then the builder.
   *   - `blank`: skip the builder entirely; the customer quote editor is the
   *     master/source of line items for this quote.
   * The DB CHECK constraint is the authoritative gate; this type is the
   * client surface.
   */
  entryMode: 'manual' | 'digital' | 'blank';
  /**
   * The measurement system locked into this quote at creation. Required —
   * the new-quote form forces the user to confirm the choice if it differs
   * from their company default. After this insert it can never be changed.
   */
  measurementSystem: 'metric' | 'imperial_ft' | 'imperial_rs';
}

export async function createQuoteWithDetails(params: CreateQuoteParams): Promise<CreateQuoteResult> {
  try {
    return await createQuoteWithDetailsInner(params);
  } catch (err) {
    // Convert known billing errors into structured failure payloads so the
    // client form can render the typed amber banner with the upgrade CTA.
    // Anything else re-throws — those are genuine bugs and should reach the
    // error overlay / 500 page.
    if (isBillingError(err)) {
      if (err instanceof QuoteLimitReachedError) {
        return {
          ok: false,
          code: 'quote_limit_reached',
          message: err.message,
          details: {
            used: err.used,
            limit: err.limit,
            periodStart: err.periodStart,
            planCode: err.planCode,
          },
        };
      }
      if (err instanceof SubscriptionInactiveError) {
        return {
          ok: false,
          code: 'subscription_inactive',
          message: err.message,
          details: { currentStatus: err.currentStatus },
        };
      }
      if (err instanceof FeatureGatedError) {
        return {
          ok: false,
          code: 'feature_gated',
          message: err.message,
          details: {
            feature: err.feature,
            currentPlan: err.currentPlan,
            requiredPlan: err.requiredPlan,
          },
        };
      }
      if (err instanceof StorageQuotaExceededError) {
        return {
          ok: false,
          code: 'storage_quota_exceeded',
          message: err.message,
          details: {
            usedBytes: err.usedBytes,
            limitBytes: err.limitBytes,
            attemptedBytes: err.attemptedBytes,
          },
        };
      }
      // Unknown billing error subclass — still better than masking it.
      return { ok: false, code: 'unknown', message: err.message };
    }
    throw err;
  }
}

async function createQuoteWithDetailsInner(params: CreateQuoteParams): Promise<CreateQuoteResult> {
  const { profile, company } = await loadCompanyContext();

  // Whitelist defensively — client could send anything.
  const safeMeasurementSystem =
    params.measurementSystem === 'metric' ||
    params.measurementSystem === 'imperial_ft' ||
    params.measurementSystem === 'imperial_rs'
      ? params.measurementSystem
      : 'metric';

  // Whitelist entry mode the same way — unknown values fall back to manual.
  const safeEntryMode: 'manual' | 'digital' | 'blank' =
    params.entryMode === 'manual' || params.entryMode === 'digital' || params.entryMode === 'blank'
      ? params.entryMode
      : 'manual';

  // Templates only apply to manual / digital quotes. A blank quote starts
  // with zero areas / components by definition; piping a template through it
  // would silently break that promise. The new-quote form already disables
  // the template selector for digital and blank modes, but we belt-and-brace
  // it here on the server.
  if (params.templateId && safeEntryMode !== 'blank') {
    const { createQuoteFromTemplate } = await import('../actions');
    await createQuoteFromTemplate(
      params.templateId,
      params.customerName,
      params.jobName,
      safeEntryMode as 'manual' | 'digital',
      safeMeasurementSystem
    );
    // createQuoteFromTemplate calls redirect() internally and never
    // returns. This line is unreachable but TypeScript still needs a
    // matching return type.
    return { ok: true };
  }

  // Otherwise, create a fresh quote via the atomic RPC. The RPC handles
  // the monthly-quote-limit check + counter increment + insert in one
  // transaction under a per-company advisory lock (Gerald audit H-02).
  // Any monthly-limit / subscription-inactive error bubbles up here and
  // is caught by the server-action outer handler at the form layer.
  const quoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    customerName: params.customerName,
    jobName: params.jobName,
    taxRate: company.default_tax_rate ?? 0,
    measurementSystem: safeMeasurementSystem,
    entryMode: safeEntryMode,
  });

  // Snapshot the company's tax library onto the new quote so totals work
  // immediately on summary/customer/accept pages. Best-effort: a failure
  // here is logged inside the helper and won't block quote creation.
  await seedQuoteTaxesOnCreate(quoteId, profile.company_id);

  return { ok: true, quoteId };
}

export async function uploadRoofPlanFile(quoteId: string, file: File): Promise<void> {
  const { company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Ownership check: the quote must belong to the caller's company before we
  // write into its storage prefix.
  const { data: ownedQuote } = await supabase
    .from('quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('company_id', company.id)
    .maybeSingle();
  if (!ownedQuote) {
    throw new Error('Unauthorized');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `plan-${Date.now()}.${fileExt}`;
  const storagePath = `${company.id}/${quoteId}/${fileName}`;

  // Upload to Supabase Storage from the server. Bucket is private; the
  // service-role-backed server client handles auth.
  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload roof plan: ${uploadError.message}`);
  }

  // Finalise: re-read real size from storage, assert quota, delete on
  // overage. The finaliser throws StorageQuotaExceededError /
  // SubscriptionInactiveError on a gated upload — those bubble up to the
  // form layer and are rendered as upgrade prompts.
  const finalised = await finaliseUpload({
    companyId: company.id,
    bucket: BUCKETS.QUOTE_DOCUMENTS,
    storagePath,
  });

  // Save metadata via server action (bypasses RLS). Use the server-measured
  // size + mime from the finaliser so the trigger that maintains
  // companies.storage_used_bytes can't be tricked by browser-supplied lies.
  await saveRoofPlanMetadata(quoteId, {
    companyId: company.id,
    fileName: file.name,
    fileSize: finalised.size,
    mimeType: finalised.mime,
    storagePath,
  });
}

async function saveRoofPlanMetadata(
  quoteId: string,
  metadata: {
    companyId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // company_id and mime_type are NOT NULL on quote_files; previous
  // versions of this insert were silently failing with a constraint
  // violation (typed Supabase pass on 2026-05-12 caught it).
  const { error } = await supabase.from('quote_files').insert({
    company_id: metadata.companyId,
    quote_id: quoteId,
    file_name: metadata.fileName,
    file_type: 'plan',
    file_size: metadata.fileSize,
    mime_type: metadata.mimeType,
    storage_path: metadata.storagePath,
  });

  if (error) {
    throw new Error(`Failed to save file metadata: ${error.message}`);
  }
}
