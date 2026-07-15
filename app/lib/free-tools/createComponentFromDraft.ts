/**
 * Smart-component draft → real `component_library` row.
 *
 * Free-calculator "Save as Smart Component" drafts (free_document_drafts,
 * draft_type='smart_component') used to only PRE-FILL the Add Component
 * form (H-04). This module creates the actual component server-side so:
 *
 *   - T3 (signed in + workspace): /api/app/restore-calc-draft creates it
 *     and lands on /components?created=<id> with the row highlighted.
 *   - T1/T2 (post-signup / post-onboarding): the dashboard banner's CTA
 *     goes through the same route, so clicking it CREATES the component
 *     instead of opening a pre-filled form.
 *
 * Field mapping mirrors the free SmartComponentTab spec 1:1. Quota and
 * subscription gates are enforced via requireComponentSlot before insert.
 */

import { createAdminClient } from '@/app/lib/supabase/admin';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';
import {
  requireComponentSlot,
  ComponentLimitReachedError,
  SubscriptionInactiveError,
} from '@/app/lib/billing/entitlements';

type CalcDraftSpec = {
  name?: string;
  measurementType?: string;
  wasteType?: string;
  wasteValue?: string;
  pricePerUnit?: string;
  pricingStrategy?: string;
  packSize?: string;
  labourAmount?: string;
  pitchEnabled?: boolean;
  pitchType?: string;
};

export type CreateFromDraftResult =
  | { ok: true; componentId: string; name: string }
  | { ok: false; code: 'not_found' | 'limit' | 'inactive' | 'error'; message?: string };

const VALID_WASTE_TYPES = new Set(['none', 'percent', 'fixed', 'fixed_per_segment']);
const VALID_PITCH_TYPES = new Set(['rafter', 'valley_hip']);
const VALID_STRATEGIES = new Set([
  'per_unit',
  'per_pack_length',
  'per_pack_area',
  'per_pack_volume',
]);

export async function createComponentFromCalcDraft(
  draftId: string,
  companyId: string,
): Promise<CreateFromDraftResult> {
  const admin = createAdminClient();

  // 1. Load the draft (unconsumed, unexpired, correct type).
  const { data: draft, error: draftError } = await admin
    .from('free_document_drafts')
    .select('id, draft_type, payload')
    .eq('id', draftId)
    .eq('draft_type', 'smart_component')
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (draftError) {
    console.error('[createComponentFromCalcDraft] draft fetch failed:', draftError);
    return { ok: false, code: 'error', message: draftError.message };
  }
  if (!draft) {
    return { ok: false, code: 'not_found' };
  }

  const payload = draft.payload as { data?: { spec?: CalcDraftSpec } } | null;
  const spec = payload?.data?.spec;
  if (!spec || typeof spec !== 'object') {
    return { ok: false, code: 'not_found' };
  }

  // 2. Tier gate — same errors createComponent surfaces.
  try {
    await requireComponentSlot(companyId);
  } catch (err) {
    if (err instanceof ComponentLimitReachedError) {
      return { ok: false, code: 'limit' };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, code: 'inactive' };
    }
    console.error('[createComponentFromCalcDraft] quota check failed:', err);
    return { ok: false, code: 'error', message: err instanceof Error ? err.message : 'quota check failed' };
  }

  // 3. Map the free-form spec onto component_library columns. Identical
  // semantics to the app's Add Component form submit (component-list.tsx):
  // pack strategies put the price in pack_price, per_unit puts it in
  // default_material_rate; waste value routes by waste type.
  const name = (spec.name || '').trim().slice(0, 120) || 'Smart Component';
  const wasteType = VALID_WASTE_TYPES.has(spec.wasteType || '') ? (spec.wasteType as string) : 'none';
  const wasteValue = Math.max(0, parseFloat(spec.wasteValue || '') || 0);
  const price = Math.max(0, parseFloat(spec.pricePerUnit || '') || 0);
  const labour = Math.max(0, parseFloat(spec.labourAmount || '') || 0);
  const strategy = VALID_STRATEGIES.has(spec.pricingStrategy || '') ? (spec.pricingStrategy as string) : 'per_unit';
  const isPack = strategy !== 'per_unit';
  const packSize = Math.max(0, parseFloat(spec.packSize || '') || 0);
  const pitchType =
    spec.pitchEnabled && VALID_PITCH_TYPES.has(spec.pitchType || '')
      ? (spec.pitchType as string)
      : spec.pitchEnabled
        ? 'rafter'
        : 'none';

  // 4. Default collection (idempotent bootstrap).
  let collectionId: string | null = null;
  try {
    collectionId = await ensureCompanyHasCollection(companyId, admin);
  } catch (err) {
    console.error('[createComponentFromCalcDraft] collection bootstrap failed (non-fatal):', err);
  }

  const insert = {
    company_id: companyId,
    collection_id: collectionId,
    name,
    component_type: 'main',
    measurement_type: spec.measurementType || 'area',
    default_material_rate: isPack ? 0 : price,
    default_labour_rate: labour,
    default_waste_type: wasteType,
    default_waste_percent: wasteType === 'percent' ? wasteValue : 0,
    default_waste_fixed: wasteType === 'fixed' || wasteType === 'fixed_per_segment' ? wasteValue : 0,
    waste_unit:
      wasteType === 'fixed'
        ? 'flat'
        : wasteType === 'fixed_per_segment'
          ? 'flat_per_segment'
          : 'percent',
    default_pitch_type: pitchType,
    pricing_strategy: strategy,
    pack_price: isPack && price > 0 ? price : null,
    pack_size: isPack && packSize > 0 ? packSize : null,
    pack_coverage_m2: null,
    notes: 'Created from the free calculator',
  };

  // database.types.ts narrows some enum columns to legacy values; the DB
  // accepts the full union (same cast the app form uses at this boundary).
  const { data: component, error: insertError } = await admin
    .from('component_library')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insert as any)
    .select('id, name')
    .single();

  if (insertError || !component) {
    console.error('[createComponentFromCalcDraft] insert failed:', insertError);
    return { ok: false, code: 'error', message: insertError?.message };
  }

  // 5. Mark the draft consumed (idempotence: a second click can't create a
  // duplicate). Best-effort — the component already exists.
  await admin
    .from('free_document_drafts')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', draftId)
    .is('consumed_at', null);

  return { ok: true, componentId: component.id, name: component.name };
}
