import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createQuoteAtomic, resolveQuoteCreationDefaults } from '@/app/lib/billing/quote-creation';
import { pitchFactor } from '@/app/lib/pricing/engine';
import { ensureCompanyHasCollection } from '@/app/lib/data/ensure-company-has-collection';

export const runtime = 'nodejs';

/**
 * GET /api/app/import-takeoff-draft?draft=<id>
 *
 * Restores a free-roof-takeoff draft (free_document_drafts,
 * draft_type='takeoff') into the app as a DIGITAL-entry quote at the
 * quote-builder stage: roof areas with pitched m2 and component groups
 * with measured lengths carry straight in, exactly like a takeoff saved
 * in-app. Rates are zero - the user prices components in the builder.
 *
 * Auth chain mirrors import-free-document: not logged in -> login with
 * return path; no company -> onboarding (the draft survives via the
 * qcp_doc_draft cookie + URL param).
 */

interface TakeoffComponentSpec {
  id: string;
  name: string;
  measurementType: 'lineal' | 'area' | 'quantity';
  materialRate: number;
  labourRate: number;
  pricingStrategy: 'per_unit' | 'per_pack_length' | 'per_pack_area';
  packPrice: number | null;
  packSize: number | null;
  wasteType: 'none' | 'percent' | 'fixed' | 'fixed_per_segment';
  wasteValue: number;
  pitchEnabled: boolean;
  pitchType: 'rafter' | 'valley_hip';
}

interface TakeoffDraftPayload {
  tool?: string;
  unit?: string;
  unitSystem?: 'metric' | 'imperial' | 'squares';
  componentSpecs?: TakeoffComponentSpec[];
  roofAreas?: { id: string; name: string; area: number; pitch: number }[];
  componentGroups?: {
    componentId: string;
    name: string;
    isSystem: boolean;
    semantic: string | null;
    count: number;
    total: number;
    measurementType?: string;
    /** Per-measurement breakdown; each entry is stamped with the roof area
     * it was drawn on (matches the app's per-area component semantics). */
    measurements?: { value: number; quoteRoofAreaId?: string | null }[];
  }[];
  savedAt?: string;
}

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draft');
  if (!draftId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `/api/app/import-takeoff-draft?draft=${draftId}`);
    return NextResponse.redirect(loginUrl);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  const companyId = profile.company_id;

  // Load the draft (unconsumed, unexpired, correct type).
  const { data: draft } = await admin
    .from('free_document_drafts')
    .select('id, payload')
    .eq('id', draftId)
    .eq('draft_type', 'takeoff')
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!draft) {
    const dash = await dashboardUrl(admin, companyId, req.url);
    return NextResponse.redirect(dash);
  }

  const payload = draft.payload as unknown as TakeoffDraftPayload;
  const roofAreas = (payload.roofAreas ?? []).filter(a => a && typeof a.area === 'number');
  const groups = (payload.componentGroups ?? []).filter(g => g && g.count > 0 && g.total > 0);
  const specs = payload.componentSpecs ?? [];

  try {
    const { trade, componentCollectionId } = await resolveQuoteCreationDefaults(companyId);

    // The quote must display in the COMPANY's default measurement system
    // (what the user picked at signup) - never a hardcoded 'metric'.
    // createQuoteAtomic defaults to metric when this is omitted (2026-08-24 bug).
    const { data: company } = await admin
      .from('companies')
      .select('default_measurement_system')
      .eq('id', companyId)
      .maybeSingle();
    const measurementSystem =
      (company?.default_measurement_system as 'metric' | 'imperial_ft' | 'imperial_rs' | null) ?? 'metric';

    // User-built components (step 2 "build your own"): create real
    // component_library rows so the user's components persist into their
    // account alongside the takeoff draft. Field mapping mirrors
    // createComponentFromCalcDraft 1:1 (app Add Component form semantics).
    const specLibIds = new Map<string, string>(); // session id -> library id
    if (specs.length > 0) {
      let specCollectionId: string | null = null;
      try {
        specCollectionId = await ensureCompanyHasCollection(companyId, admin);
      } catch {
        // non-fatal - insert with null collection
      }
      for (const spec of specs) {
        const isPack = spec.pricingStrategy !== 'per_unit' && !!spec.packPrice && !!spec.packSize;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row: any = {
          company_id: companyId,
          collection_id: specCollectionId,
          name: (spec.name || 'Component').slice(0, 120),
          component_type: 'main',
          measurement_type: spec.measurementType === 'quantity' ? 'quantity' : spec.measurementType,
          default_material_rate: isPack ? 0 : spec.materialRate || 0,
          default_labour_rate: spec.labourRate || 0,
          default_waste_type: spec.wasteType || 'none',
          default_waste_percent: spec.wasteType === 'percent' ? spec.wasteValue || 0 : 0,
          default_waste_fixed: spec.wasteType === 'fixed' || spec.wasteType === 'fixed_per_segment' ? spec.wasteValue || 0 : 0,
          waste_unit:
            spec.wasteType === 'fixed' ? 'flat' : spec.wasteType === 'fixed_per_segment' ? 'flat_per_segment' : 'percent',
          default_pitch_type: spec.pitchEnabled ? spec.pitchType : 'none',
          pricing_strategy: isPack ? spec.pricingStrategy : 'per_unit',
          pack_price: isPack ? spec.packPrice : null,
          pack_size: isPack ? spec.packSize : null,
          notes: 'Created from the free roof takeoff tool',
        };
        const { data: inserted, error: insertErr } = await admin
          .from('component_library')
          .insert(row)
          .select('id')
          .single();
        if (!insertErr && inserted) specLibIds.set(spec.id, inserted.id);
      }
    }

    const quoteId = await createQuoteAtomic(companyId, session.user.id, {
      customerName: 'Roof Takeoff',
      jobName: 'Free tool takeoff',
      entryMode: 'digital',
      trade,
      componentCollectionId,
      measurementSystem,
      currency: 'NZD',
      materialMarginPercent: 0,
      materialMarginEnabled: false,
    });

    // Roof areas: plan m2 -> pitched m2 via the real pitch-factor engine.
    // Keep the draft-area-id -> inserted-row-id map so component groups can
    // attach to the roof area they were measured on.
    const areaIdMap = new Map<string, string>();
    let firstAreaId: string | null = null;
    if (roofAreas.length > 0) {
      const rows = roofAreas.map((a, i) => {
        const factor = pitchFactor(a.pitch || 0, 'rafter');
        const pitched = a.area * factor;
        return {
          quote_id: quoteId,
          label: a.name || `Roof Area ${i + 1}`,
          sort_order: i,
          input_mode: 'calculated' as const,
          calc_pitch_degrees: a.pitch || 0,
          calc_plan_sqm: a.area,
          // In-app takeoff stores the PITCHED area in computed_sqm (what the
          // builder header displays) - match that exactly (2026-08-23).
          computed_sqm: pitched,
          final_value_sqm: pitched,
        };
      });
      const { data: insertedAreas, error: areasError } = await admin
        .from('quote_roof_areas')
        .insert(rows)
        .select('id');
      if (areasError) throw new Error(`roof areas: ${areasError.message}`);
      insertedAreas?.forEach((r, i) => areaIdMap.set(roofAreas[i].id, r.id));
      firstAreaId = insertedAreas?.[0]?.id ?? null;
    }

    // Component groups: one quote_components row per group, one combined
    // entry with the measured total. User-built components link to their new
    // component_library rows and carry the spec rates/waste/pitch through.
    // Split per roof area: one quote_components row per (group, area) pair,
    // attached to the area the measurements were drawn on, with one
    // quote_component_entries row PER MEASUREMENT - mirroring exactly what
    // the free tool report shows (2026-08-23 fix).
    if (groups.length > 0) {
      // area bucket key: draft area id, or '' for un-stamped entries
      // (attach to the first area).
      const bucketKey = (areaId: string | null | undefined) =>
        (areaId && areaIdMap.get(areaId) ? areaId : roofAreas[0]?.id) ?? '';
      type Row = {
        row: Record<string, unknown>;
        measurements: { value: number; final: number }[];
      };
      const rows: Row[] = [];
      let sortIdx = 0;
      for (const g of groups) {
        const spec = specs.find(s => s.id === g.componentId);
        const libId = spec ? specLibIds.get(spec.id) ?? null : null;
        const isPack = spec && spec.pricingStrategy !== 'per_unit' && !!spec.packPrice && !!spec.packSize;
        const ms = (g.measurements && g.measurements.length > 0)
          ? g.measurements
          : [{ value: g.total, quoteRoofAreaId: null }];
        // Bucket measurements by roof area, preserving draw order within each.
        const buckets = new Map<string, { value: number; quoteRoofAreaId?: string | null }[]>();
        for (const m of ms) {
          const k = bucketKey(m.quoteRoofAreaId);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k)!.push(m);
        }
        for (const [k, bucket] of buckets) {
          const total = bucket.reduce((s, m) => s + m.value, 0);
          // FINAL values (pitch + waste per entry), identical to the free
          // tool's report: plan -> pitched (entry's area pitch, spec pitch
          // type) -> incl waste. Stored as value_after_waste so the quote
          // builder shows the finished figures straight away (2026-08-23).
          const bucketArea = roofAreas.find(ra => ra.id === k);
          const areaPitch = bucketArea?.pitch || 0;
          // Area components (e.g. Roofing) get the RAFTER pitch of the roof
          // area they sit under, then waste - matching the free tool report
          // (fixed 2026-08-23: was skipping pitch for area components).
          const pitchT = spec && spec.pitchEnabled && g.measurementType !== 'quantity'
            ? (g.measurementType === 'area' ? 'rafter' : spec.pitchType)
            : 'none';
          const finalOf = (raw: number) => {
            let v = raw;
            if (pitchT !== 'none') {
              v = raw * pitchFactor(areaPitch, pitchT === 'rafter' ? 'rafter' : 'valley_hip');
            }
            if (spec) {
              if (spec.wasteType === 'percent') v *= 1 + (spec.wasteValue || 0) / 100;
              else if (spec.wasteType === 'fixed' || spec.wasteType === 'fixed_per_segment') v += spec.wasteValue || 0;
            }
            return v;
          };
          const finalTotal = bucket.reduce((s, m) => s + finalOf(m.value), 0);
          rows.push({
            row: {
              quote_id: quoteId,
              name: g.name,
              component_type: 'main',
              measurement_type: (g.measurementType === 'area' ? 'area' : 'lineal'),
              input_mode: 'calculated',
              quote_roof_area_id: areaIdMap.get(k) ?? firstAreaId,
              component_library_id: libId,
              material_rate: spec ? (isPack ? 0 : spec.materialRate || 0) : 0,
              labour_rate: spec ? spec.labourRate || 0 : 0,
              // Price the final (pitch + waste) quantity at the spec rates so
              // the builder shows the same dollars as the free tool report.
              material_cost: spec && !isPack ? finalTotal * (spec.materialRate || 0) : 0,
              labour_cost: spec ? finalTotal * (spec.labourRate || 0) : 0,
              waste_type: spec ? spec.wasteType : 'none',
              waste_percent: spec && spec.wasteType === 'percent' ? spec.wasteValue || 0 : 0,
              // Fixed/per-segment waste multiplies by THIS area's entry count
              // (matches the app's per-entry waste semantics).
              waste_fixed:
                spec && (spec.wasteType === 'fixed' || spec.wasteType === 'fixed_per_segment')
                  ? (spec.wasteValue || 0) * bucket.length
                  : 0,
              pitch_type: spec && spec.pitchEnabled ? spec.pitchType : 'none',
              pack_size_snapshot: spec && spec.pricingStrategy !== 'per_unit' ? spec.packSize : null,
              is_customer_visible: true,
              sort_order: sortIdx++,
              calc_raw_value: total,
              final_quantity: finalTotal,
              final_value: finalTotal,
            },
            measurements: bucket.map(m => ({ value: m.value, final: finalOf(m.value) })),
          });
        }
      }
      const { data: insertedComps, error: compsError } = await admin
        .from('quote_components')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(rows.map(r => r.row) as any[])
        .select('id');
      if (compsError) throw new Error(`components: ${compsError.message}`);

      if (insertedComps && insertedComps.length > 0) {
        const entryRows = insertedComps.flatMap((c, i) =>
          rows[i].measurements.map((m, j) => ({
            quote_component_id: c.id,
            raw_value: m.value,
            value_after_waste: (m as { final: number }).final,
            sort_order: j,
            is_combined: false,
          }))
        );
        const { error: entriesError } = await admin
          .from('quote_component_entries')
          .insert(entryRows);
        if (entriesError) throw new Error(`entries: ${entriesError.message}`);
      }
    }

    // Consume the draft so a reload can't double-import.
    await admin
      .from('free_document_drafts')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', draftId)
      .is('consumed_at', null);

    const dash = await dashboardUrl(admin, companyId, req.url);
    // dest=components (banner click) lands the user on their component
    // library so they immediately see what was imported.
    const target =
      req.nextUrl.searchParams.get('dest') === 'components'
        ? new URL(`/${dash.pathname.split('/')[1]}/components`, dash.origin)
        : new URL(`/${dash.pathname.split('/')[1]}/quotes/${quoteId}/build`, dash.origin);
    const res = NextResponse.redirect(target);
    // Clear the signup handoff cookies so the dashboard banner stops
    // offering the (now consumed) draft.
    for (const name of ['qcp_signup_draft', 'qcp_signup_ref']) {
      res.cookies.set({ name, value: '', path: '/', maxAge: 0 });
      res.cookies.set({ name, value: '', path: '/', maxAge: 0, domain: '.quote-core.com' });
    }
    // Show the "where is my takeoff" helper banner until the user dismisses
    // it (TakeoffDraftNoteBanner on the dashboard reads this cookie).
    res.cookies.set({ name: 'qcp_takeoff_note', value: '1', path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' });
    res.cookies.set({ name: 'qcp_takeoff_note', value: '1', path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', domain: '.quote-core.com' });
    return res;
  } catch (err) {
    console.error('[import-takeoff-draft] failed:', err);
    const dash = await dashboardUrl(admin, companyId, req.url);
    return NextResponse.redirect(dash);
  }
}

async function dashboardUrl(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  requestUrl: string,
): Promise<URL> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle();
  const slug = company?.slug || 'workspace';
  return new URL(`/${slug}`, requestUrl);
}
